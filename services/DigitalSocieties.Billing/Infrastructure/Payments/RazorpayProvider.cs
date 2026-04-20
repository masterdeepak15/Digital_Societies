using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Billing.Infrastructure.Payments;

public sealed class RazorpaySettings
{
    public const string SectionName = "Razorpay";
    public string KeyId         { get; init; } = default!;
    public string KeySecret     { get; init; } = default!;
    public string WebhookSecret { get; init; } = default!;
}

/// <summary>
/// Razorpay IPaymentProvider implementation.
/// OCP: swap to CashfreeProvider by registering a different concrete in DI.
/// DIP: application never imports Razorpay SDK — depends on IPaymentProvider only.
/// Security: webhook HMAC-SHA256 verified; never trust payload without signature check.
/// </summary>
public sealed class RazorpayProvider : IPaymentProvider
{
    public string ProviderName => "razorpay";

    private readonly RazorpaySettings _settings;
    private readonly HttpClient        _http;

    public RazorpayProvider(IOptions<RazorpaySettings> settings, IHttpClientFactory factory)
    {
        _settings = settings.Value;
        _http     = factory.CreateClient("razorpay");
        // Basic auth: KeyId:KeySecret
        var auth = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_settings.KeyId}:{_settings.KeySecret}"));
        _http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", auth);
    }

    // ── Create Order ──────────────────────────────────────────────────────
    public async Task<PaymentOrderResult> CreateOrderAsync(CreateOrderRequest req, CancellationToken ct)
    {
        try
        {
            var body = new
            {
                amount   = (long)(req.Amount * 100),   // Razorpay expects paise
                currency = req.Currency,
                receipt  = req.ReceiptId[..Math.Min(req.ReceiptId.Length, 40)],  // max 40 chars
                notes    = req.Notes ?? new Dictionary<string, string>(),
            };

            var response = await _http.PostAsJsonAsync("https://api.razorpay.com/v1/orders", body, ct);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync(ct);
                return new PaymentOrderResult(false, null, null, $"Razorpay error: {err}");
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            var orderId = json.GetProperty("id").GetString()!;

            return new PaymentOrderResult(true, orderId, null);   // mobile opens checkout sheet
        }
        catch (Exception ex)
        {
            return new PaymentOrderResult(false, null, null, ex.Message);
        }
    }

    // ── Verify Webhook Signature ─────────────────────────────────────────
    public Task<PaymentVerifyResult> VerifyWebhookAsync(string payload, string signature, CancellationToken ct)
    {
        // Razorpay sends X-Razorpay-Signature = HMAC-SHA256(payload, webhook_secret)
        var expectedSig = ComputeHmacSha256(payload, _settings.WebhookSecret);
        bool valid      = string.Equals(expectedSig, signature, StringComparison.OrdinalIgnoreCase);

        PaymentVerifyResult result;
        if (valid)
        {
            var json      = JsonSerializer.Deserialize<JsonElement>(payload);
            var entity    = json.GetProperty("payload").GetProperty("payment").GetProperty("entity");
            var paymentId = entity.GetProperty("id").GetString();
            var orderId   = entity.GetProperty("order_id").GetString();
            var amount    = entity.GetProperty("amount").GetInt64();
            result = new PaymentVerifyResult(true, paymentId, orderId, amount / 100m, "captured");
        }
        else
        {
            result = new PaymentVerifyResult(false, null, null, null, null);
        }
        return Task.FromResult(result);
    }

    // ── Refund ────────────────────────────────────────────────────────────
    public async Task<RefundResult> RefundAsync(RefundRequest req, CancellationToken ct)
    {
        try
        {
            var body = new { amount = (long)(req.Amount * 100), notes = new { reason = req.Reason } };
            var response = await _http.PostAsJsonAsync(
                $"https://api.razorpay.com/v1/payments/{req.PaymentId}/refund", body, ct);

            if (!response.IsSuccessStatusCode)
                return new RefundResult(false, null, "Refund failed");

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            return new RefundResult(true, json.GetProperty("id").GetString());
        }
        catch (Exception ex)
        {
            return new RefundResult(false, null, ex.Message);
        }
    }

    private static string ComputeHmacSha256(string data, string key)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return Convert.ToHexString(hash).ToLower();
    }
}
