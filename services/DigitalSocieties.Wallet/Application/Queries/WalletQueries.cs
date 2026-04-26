using MediatR;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Wallet.Domain.Entities;
using DigitalSocieties.Wallet.Infrastructure.Persistence;

namespace DigitalSocieties.Wallet.Application.Queries;

public sealed record WalletBalanceDto(
    Guid    WalletId,
    decimal BalanceRupees,
    int     TotalTransactions);

public sealed record WalletTxnDto(
    Guid           Id,
    long           AmountPaise,
    string         Direction,
    string         Type,
    string         Description,
    long           BalanceAfterPaise,
    string?        ReferenceId,
    DateTimeOffset CreatedAt);

// ── Get balance ────────────────────────────────────────────────────────────
public sealed record GetWalletBalanceQuery : IRequest<Result<WalletBalanceDto>>;

public sealed class GetWalletBalanceHandler
    : IRequestHandler<GetWalletBalanceQuery, Result<WalletBalanceDto>>
{
    private readonly WalletDbContext _db;
    private readonly ICurrentUser    _cu;
    public GetWalletBalanceHandler(WalletDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<WalletBalanceDto>> Handle(GetWalletBalanceQuery _, CancellationToken ct)
    {
        if (_cu.SocietyId is null || _cu.FlatId is null)
            return Result<WalletBalanceDto>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var wallet = await _db.WalletAccounts
            .Where(w => w.FlatId == _cu.FlatId.Value && w.SocietyId == _cu.SocietyId.Value)
            .Select(w => new WalletBalanceDto(
                w.Id,
                w.BalancePaise / 100m,
                _db.WalletTransactions.Count(t => t.WalletId == w.Id)))
            .FirstOrDefaultAsync(ct);

        if (wallet is null)
            return Result<WalletBalanceDto>.Fail("WALLET.NOT_FOUND",
                "No wallet found. Call /wallet/ensure to create one.");

        return Result<WalletBalanceDto>.Ok(wallet);
    }
}

// ── Get transaction history ────────────────────────────────────────────────
public sealed record GetWalletTransactionsQuery(int Page, int PageSize)
    : IRequest<Result<List<WalletTxnDto>>>;

public sealed class GetWalletTransactionsHandler
    : IRequestHandler<GetWalletTransactionsQuery, Result<List<WalletTxnDto>>>
{
    private readonly WalletDbContext _db;
    private readonly ICurrentUser    _cu;
    public GetWalletTransactionsHandler(WalletDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<List<WalletTxnDto>>> Handle(
        GetWalletTransactionsQuery q, CancellationToken ct)
    {
        if (_cu.SocietyId is null || _cu.FlatId is null)
            return Result<List<WalletTxnDto>>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var walletId = await _db.WalletAccounts
            .Where(w => w.FlatId == _cu.FlatId.Value && w.SocietyId == _cu.SocietyId.Value)
            .Select(w => (Guid?)w.Id)
            .FirstOrDefaultAsync(ct);

        if (walletId is null)
            return Result<List<WalletTxnDto>>.Fail("WALLET.NOT_FOUND", "Wallet not found.");

        var txns = await _db.WalletTransactions
            .Where(t => t.WalletId == walletId.Value)
            .OrderByDescending(t => t.CreatedAt)
            .Skip((q.Page - 1) * q.PageSize)
            .Take(q.PageSize)
            .Select(t => new WalletTxnDto(
                t.Id, t.AmountPaise,
                t.Direction.ToString(), t.Type.ToString(),
                t.Description, t.BalanceAfterPaise,
                t.ReferenceId, t.CreatedAt))
            .ToListAsync(ct);

        return Result<List<WalletTxnDto>>.Ok(txns);
    }
}
