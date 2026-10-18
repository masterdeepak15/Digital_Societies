using DigitalSocieties.Accounting.Domain.Entities;
using DigitalSocieties.Accounting.Infrastructure.Persistence;
using DigitalSocieties.Facility.Domain.Entities;
using DigitalSocieties.Facility.Infrastructure.Persistence;
using DigitalSocieties.Marketplace.Domain.Entities;
using DigitalSocieties.Marketplace.Infrastructure.Persistence;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Social.Domain.Entities;
using DigitalSocieties.Social.Infrastructure.Persistence;
using DigitalSocieties.Wallet.Domain.Entities;
using DigitalSocieties.Wallet.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using FacilityEntity = DigitalSocieties.Facility.Domain.Entities.Facility;

namespace DigitalSocieties.Api.Infrastructure.Seeding;

/// <summary>
/// Demo data for the modules the base seed does not cover (facilities, ledger, social feed,
/// service marketplace, wallets). Each block is idempotent, so it also tops up a database that
/// was seeded before these modules existed.
/// </summary>
public sealed partial class DataSeeder
{
    private static Money Rs(decimal rupees) => Money.CreateInr(rupees).Value!;

    public static async Task SeedExtrasAsync(IServiceProvider sp, ILogger logger)
    {
        await SeedFacilitiesAsync(sp.GetRequiredService<FacilityDbContext>(), logger);
        await SeedLedgerAsync(sp.GetRequiredService<AccountingDbContext>(), logger);
        await SeedSocialAsync(sp.GetRequiredService<SocialDbContext>(), logger);
        await SeedMarketplaceAsync(sp.GetRequiredService<MarketplaceDbContext>(), logger);
        await SeedWalletsAsync(sp.GetRequiredService<WalletDbContext>(), logger);
    }

    // ── Facilities + bookings ────────────────────────────────────────────────
    private static async Task SeedFacilitiesAsync(FacilityDbContext db, ILogger logger)
    {
        if (await db.Facilities.AnyAsync(f => f.SocietyId == SocietyId)) return;

        var clubhouse = FacilityEntity.Create(SocietyId, "Clubhouse", "Party hall with kitchenette and AC.", 40, 120, new TimeOnly(8, 0), new TimeOnly(22, 0));
        var pool      = FacilityEntity.Create(SocietyId, "Swimming pool", "Adults' pool, lifeguard on duty.", 20, 60, new TimeOnly(6, 0), new TimeOnly(20, 0));
        var tennis    = FacilityEntity.Create(SocietyId, "Tennis court", "Floodlit synthetic court.", 4, 60, new TimeOnly(6, 0), new TimeOnly(21, 0));
        var gym       = FacilityEntity.Create(SocietyId, "Gym", "Cardio and free weights.", 15, 60, new TimeOnly(5, 0), new TimeOnly(23, 0));
        db.Facilities.AddRange(clubhouse, pool, tennis, gym);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var b1 = FacilityBooking.Create(pool.Id,      SocietyId, FlatIds[0], ResidentIds[0], today,             new TimeOnly(7, 0),  new TimeOnly(8, 0));
        var b2 = FacilityBooking.Create(tennis.Id,    SocietyId, FlatIds[2], ResidentIds[2], today,             new TimeOnly(18, 0), new TimeOnly(19, 0));
        var b3 = FacilityBooking.Create(clubhouse.Id, SocietyId, FlatIds[4], ResidentIds[4], today.AddDays(1),  new TimeOnly(18, 0), new TimeOnly(20, 0));
        var b4 = FacilityBooking.Create(gym.Id,       SocietyId, FlatIds[5], ResidentIds[5], today.AddDays(1),  new TimeOnly(6, 0),  new TimeOnly(7, 0));
        var b5 = FacilityBooking.Create(pool.Id,      SocietyId, FlatIds[7], ResidentIds[7], today.AddDays(2),  new TimeOnly(17, 0), new TimeOnly(18, 0));
        b5.Cancel("Guests cancelled");
        db.Bookings.AddRange(b1, b2, b3, b4, b5);

        await db.SaveChangesAsync();
        logger.LogInformation("[Seeder] Facilities: 4 facilities, 5 bookings.");
    }

    // ── Ledger ───────────────────────────────────────────────────────────────
    private static async Task SeedLedgerAsync(AccountingDbContext db, ILogger logger)
    {
        if (await db.LedgerEntries.AnyAsync(e => e.SocietyId == SocietyId)) return;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        LedgerEntry E(EntryType t, string cat, string desc, decimal rupees, int daysAgo)
            => LedgerEntry.Create(SocietyId, t, cat, desc, Rs(rupees), today.AddDays(-daysAgo), AccountantId);

        var entries = new List<LedgerEntry>
        {
            E(EntryType.Income,  "Maintenance", "Maintenance collected (weekly roll-up)", 84000, 3),
            E(EntryType.Income,  "Maintenance", "Maintenance collected (weekly roll-up)", 96000, 10),
            E(EntryType.Income,  "Facility",    "Clubhouse booking fees", 6000, 6),
            E(EntryType.Income,  "Other",       "Parking sticker fees", 4500, 15),
            E(EntryType.Expense, "Utilities",   "Common area electricity bill", 18400, 5),   // pending approval (> Rs 10,000)
            E(EntryType.Expense, "Security",    "Security agency, monthly invoice", 62000, 8), // pending approval
            E(EntryType.Expense, "Repairs",     "Lift motor repair, Block B", 24500, 2),       // pending approval
            E(EntryType.Expense, "Housekeeping","Cleaning supplies", 3200, 4),
            E(EntryType.Expense, "Garden",      "Gardener and plants", 5400, 12),
            E(EntryType.Expense, "Admin",       "Stationery and printing", 1800, 20),
            E(EntryType.Expense, "Repairs",     "Gate motor replacement (quote under review)", 38000, 9), // will be rejected
        };

        entries[^1].Reject(AdminUserId, "Please get two more quotes before approving.");
        db.LedgerEntries.AddRange(entries);
        await db.SaveChangesAsync();
        logger.LogInformation("[Seeder] Ledger: {Count} entries.", entries.Count);
    }

    // ── Social feed ──────────────────────────────────────────────────────────
    private static async Task SeedSocialAsync(SocialDbContext db, ILogger logger)
    {
        if (await db.Posts.AnyAsync(p => p.SocietyId == SocietyId)) return;

        SocialPost Post(int resident, string category, string body)
            => SocialPost.Create(SocietyId, ResidentIds[resident], FlatIds[resident], category, body).Value!;

        var p1 = Post(0, "general",        "Good morning all! The new jogging track near Block A is open. Please keep it clear of bicycles.");
        var p2 = Post(3, "lost_found",     "Found a bunch of keys with a blue tag near the gate 2 bench. Collect from the security desk.");
        var p3 = Post(1, "recommendation", "Can anyone recommend a reliable AC service person? Mine stopped cooling.");
        var p4 = Post(6, "event",          "Diwali get-together at the clubhouse this Saturday, 7 pm. Bring a dish to share!");
        var p5 = Post(4, "warning",        "Two-wheelers are being parked in the fire lane near Block B. Please move them.");
        var poll = Post(8, "poll",         "Which day works best for the annual society picnic?");
        db.Posts.AddRange(p1, p2, p3, p4, p5, poll);

        db.Polls.Add(SocialPoll.Create(poll.Id, "Which day works best for the annual society picnic?",
            ["Saturday 8th", "Sunday 9th", "Saturday 15th"], DateTimeOffset.UtcNow.AddDays(5)).Value!);

        db.Comments.AddRange(
            PostComment.Create(p3.Id, ResidentIds[2], FlatIds[2], "Try the person who serviced Block C last month, very punctual.").Value!,
            PostComment.Create(p3.Id, ResidentIds[5], FlatIds[5], "Seconding that. I can share the number.").Value!,
            PostComment.Create(p4.Id, ResidentIds[9], FlatIds[9], "Count us in!").Value!);

        await db.SaveChangesAsync();
        logger.LogInformation("[Seeder] Social: 6 posts, 1 poll, 3 comments.");
    }

    // ── Service marketplace ──────────────────────────────────────────────────
    private static async Task SeedMarketplaceAsync(MarketplaceDbContext db, ILogger logger)
    {
        if (await db.ServiceListings.AnyAsync(l => l.SocietyId == SocietyId)) return;

        ServiceListing L(string name, string phone, ServiceCategory cat, string title, string desc, decimal rate, RateUnit unit)
            => ServiceListing.Create(SocietyId, StaffUserId, name, phone, cat, title, desc, Rs(rate), unit);

        var plumber     = L("Ramesh Yadav",   "+919811100001", ServiceCategory.Plumber,     "Plumbing repairs", "Leaks, taps, fittings. 10 years in the area.", 400, RateUnit.PerVisit);
        var electrician = L("Anil Pawar",     "+919811100002", ServiceCategory.Electrician, "Electrician",      "Wiring, MCB, fans and lights.", 350, RateUnit.PerVisit);
        var cleaner     = L("Sunita Bai",     "+919811100003", ServiceCategory.Cleaner,     "Deep cleaning",    "Kitchen and bathroom deep clean.", 250, RateUnit.PerHour);
        var ac          = L("Cool Fix Services", "+919811100004", ServiceCategory.AcRepair, "AC service and gas refill", "Split and window AC.", 700, RateUnit.PerVisit);
        plumber.UpdateRating(4.6f, 18);
        electrician.UpdateRating(4.4f, 11);
        cleaner.UpdateRating(4.8f, 25);
        ac.UpdateRating(4.2f, 7);
        db.ServiceListings.AddRange(plumber, electrician, cleaner, ac);

        db.ServiceBookings.Add(ServiceBooking.Create(SocietyId, plumber.Id, ResidentIds[3], FlatIds[3],
            DateTimeOffset.UtcNow.AddDays(1), Rs(400), "Kitchen tap is leaking."));

        await db.SaveChangesAsync();
        logger.LogInformation("[Seeder] Marketplace: 4 listings, 1 booking.");
    }

    // ── Wallets (per resident flat) ──────────────────────────────────────────
    private static async Task SeedWalletsAsync(WalletDbContext db, ILogger logger)
    {
        if (await db.WalletAccounts.AnyAsync(w => w.SocietyId == SocietyId)) return;

        for (int i = 0; i < 3; i++)
        {
            var wallet = WalletAccount.Create(SocietyId, FlatIds[i], ResidentIds[i]);
            wallet.Credit(500000, WalletTxnType.TopUp, "Wallet top-up", $"seed-topup-{i}");          // Rs 5,000
            wallet.Debit(300000, WalletTxnType.BillPayment, "Maintenance paid from wallet", $"seed-bill-{i}"); // Rs 3,000
            wallet.Credit(25000, WalletTxnType.Cashback, "Early payment cashback");                  // Rs 250
            db.WalletAccounts.Add(wallet);
        }

        await db.SaveChangesAsync();
        logger.LogInformation("[Seeder] Wallets: 3 wallets with transactions.");
    }
}
