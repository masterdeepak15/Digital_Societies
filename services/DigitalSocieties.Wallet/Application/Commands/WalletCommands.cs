using MediatR;
using Microsoft.EntityFrameworkCore;
using Razorpay.Api;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Wallet.Domain.Entities;
using DigitalSocieties.Wallet.Infrastructure.Persistence;
using DigitalSocieties.Wallet.Infrastructure.Settings;
using Microsoft.Extensions.Options;

namespace DigitalSocieties.Wallet.Application.Commands;

// ── Get or create wallet (idempotent) ─────────────────────────────────────
public sealed record EnsureWalletCommand : IRequest<Result<Guid>>;

public sealed class EnsureWalletHandler : IRequestHandler<EnsureWalletCommand, Result<Guid>>
{
    private readonly WalletDbContext _db;
    private readonly ICurrentUser    _cu;
    public EnsureWalletHandler(WalletDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<Guid>> Handle(EnsureWalletCommand _, CancellationToken ct)
    {
        if (_cu.SocietyId is null || _cu.FlatId is null || _cu.UserId is null)
            return Result<Guid>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var existing = await _db.WalletAccounts
            .FirstOrDefaultAsync(w => w.FlatId    == _cu.FlatId.Value
                                   && w.SocietyId == _cu.SocietyId.Value, ct);

        if (existing is not null) return Result<Guid>.Ok(existing.Id);

        var wallet = WalletAccount.Create(_cu.SocietyId.Value, _cu.FlatId.Value, _cu.UserId.Value);
        _db.WalletAccounts.Add(wallet);
        await _db.SaveChangesAsync(ct);
        return Result<Guid>.Ok(wallet.Id);
    }
}

// ── Initiate top-up — create Razorpay order ─────────────────────────────
public sealed record InitiateTopUpCommand(decimal AmountRupees) : IRequest<Result<TopUpOrderDto>>;

public sealed record TopUpOrderDto(string OrderId, decimal Amount, string Currency, string Key);

public sealed class InitiateTopUpHandler : IRequestHandler<InitiateTopUpCommand, Result<TopUpOrderDto>>
{
    private readonly WalletDbContext  _db;
    private readonly ICurrentUser     _cu;
    private readonly WalletSettings   _settings;

    public InitiateTopUpHandler(WalletDbContext db, ICurrentUser cu, IOptions<WalletSettings> opts)
        => (_db, _cu, _settings) = (db, cu, opts.Value);

    public async Task<Result<TopUpOrderDto>> Handle(InitiateTopUpCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is null || _cu.FlatId is null)
            return Result<TopUpOrderDto>.Fail("AUTH.REQUIRED", "Authentication context required.");

        if (cmd.AmountRupees < 10m)
            return Result<TopUpOrderDto>.Fail("WALLET.MIN_TOPUP", "Minimum top-up is ₹10.");

        if (cmd.AmountRupees > 50_000m)
            return Result<TopUpOrderDto>.Fail("WALLET.MAX_TOPUP", "Maximum top-up is ₹50,000 per transaction.");

        var wallet = await _db.WalletAccounts
            .FirstOrDefaultAsync(w => w.FlatId == _cu.FlatId.Value
                                   && w.SocietyId == _cu.SocietyId.Value, ct);

        if (wallet is null)
            return Result<TopUpOrderDto>.Fail("WALLET.NOT_FOUND",
                "Wallet not found. Call /wallet/ensure first.");

        var client = new RazorpayClient(_settings.KeyId, _settings.KeySecret);
        var paise  = (int)(cmd.AmountRupees * 100);

        var orderParams = new Dictionary<string, object>
        {
            ["amount"]   = paise,
            ["currency"] = "INR",
            ["receipt"]  = $"wallet-topup-{wallet.Id:N}-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}",
            ["notes"]    = new Dictionary<string, string>
            {
                ["wallet_id"] = wallet.Id.ToString(),
                ["flat_id"]   = _cu.FlatId.Value.ToString(),
            },
        };

        var order = client.Order.Create(orderParams);
        return Result<TopUpOrderDto>.Ok(
            new TopUpOrderDto(order["id"].ToString()!, cmd.AmountRupees, "INR", _settings.KeyId));
    }
}

// ── Verify top-up payment (Razorpay webhook / client callback) ────────────
public sealed record VerifyTopUpCommand(
    string OrderId,
    string PaymentId,
    string Signature) : IRequest<Result>;

public sealed class VerifyTopUpHandler : IRequestHandler<VerifyTopUpCommand, Result>
{
    private readonly WalletDbContext _db;
    private readonly ICurrentUser    _cu;
    private readonly WalletSettings  _settings;

    public VerifyTopUpHandler(WalletDbContext db, ICurrentUser cu, IOptions<WalletSettings> opts)
        => (_db, _cu, _settings) = (db, cu, opts.Value);

    public async Task<Result> Handle(VerifyTopUpCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is null || _cu.FlatId is null)
            return Result.Fail("AUTH.REQUIRED", "Authentication context required.");

        // Verify HMAC signature
        var payload   = $"{cmd.OrderId}|{cmd.PaymentId}";
        var secretKey = System.Text.Encoding.UTF8.GetBytes(_settings.KeySecret);
        using var hmac = new System.Security.Cryptography.HMACSHA256(secretKey);
        var hash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(payload));
        var expected = BitConverter.ToString(hash).Replace("-", "").ToLower();

        if (!string.Equals(expected, cmd.Signature, StringComparison.OrdinalIgnoreCase))
            return Result.Fail("PAYMENT.INVALID_SIGNATURE", "Razorpay signature mismatch.");

        // Fetch order amount from Razorpay
        var client  = new RazorpayClient(_settings.KeyId, _settings.KeySecret);
        var order   = client.Order.Fetch(cmd.OrderId);
        var paise   = long.Parse(order["amount"].ToString()!);

        var wallet = await _db.WalletAccounts
            .FirstOrDefaultAsync(w => w.FlatId    == _cu.FlatId.Value
                                   && w.SocietyId == _cu.SocietyId.Value, ct);

        if (wallet is null)
            return Result.Fail("WALLET.NOT_FOUND", "Wallet not found.");

        // Idempotency: skip if already credited for this payment
        if (await _db.WalletTransactions.AnyAsync(t => t.ReferenceId == cmd.PaymentId, ct))
            return Result.Ok(); // already processed

        var r = wallet.Credit(paise, WalletTxnType.TopUp,
            $"Wallet top-up via Razorpay", cmd.PaymentId);
        if (r.IsFailure) return r;

        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Spend from wallet ──────────────────────────────────────────────────────
public sealed record SpendFromWalletCommand(
    long   AmountPaise,
    string TxnType,
    string Description,
    string ReferenceId) : IRequest<Result>;

public sealed class SpendFromWalletHandler : IRequestHandler<SpendFromWalletCommand, Result>
{
    private readonly WalletDbContext _db;
    private readonly ICurrentUser    _cu;
    public SpendFromWalletHandler(WalletDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(SpendFromWalletCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is null || _cu.FlatId is null)
            return Result.Fail("AUTH.REQUIRED", "Authentication context required.");

        if (!Enum.TryParse<WalletTxnType>(cmd.TxnType, true, out var txnType))
            return Result.Fail("WALLET.INVALID_TXN_TYPE", $"Unknown txn type: {cmd.TxnType}");

        var wallet = await _db.WalletAccounts
            .FirstOrDefaultAsync(w => w.FlatId    == _cu.FlatId.Value
                                   && w.SocietyId == _cu.SocietyId.Value, ct);

        if (wallet is null) return Result.Fail("WALLET.NOT_FOUND", "Wallet not found.");

        var r = wallet.Debit(cmd.AmountPaise, txnType, cmd.Description, cmd.ReferenceId);
        if (r.IsFailure) return r;

        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Refund to wallet ───────────────────────────────────────────────────────
public sealed record RefundToWalletCommand(
    Guid   FlatId,
    long   AmountPaise,
    string Description,
    string ReferenceId) : IRequest<Result>;

public sealed class RefundToWalletHandler : IRequestHandler<RefundToWalletCommand, Result>
{
    private readonly WalletDbContext _db;
    private readonly ICurrentUser    _cu;
    public RefundToWalletHandler(WalletDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(RefundToWalletCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is null)
            return Result.Fail("AUTH.REQUIRED", "Authentication context required.");

        var wallet = await _db.WalletAccounts
            .FirstOrDefaultAsync(w => w.FlatId    == cmd.FlatId
                                   && w.SocietyId == _cu.SocietyId.Value, ct);

        if (wallet is null) return Result.Fail("WALLET.NOT_FOUND", "Wallet not found.");

        var r = wallet.Credit(cmd.AmountPaise, WalletTxnType.Refund,
            cmd.Description, cmd.ReferenceId);
        if (r.IsFailure) return r;

        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
