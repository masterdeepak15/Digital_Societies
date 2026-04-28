using DigitalSocieties.Billing.Domain.Entities;
using DigitalSocieties.Billing.Infrastructure.Persistence;
using DigitalSocieties.Communication.Domain.Entities;
using DigitalSocieties.Communication.Infrastructure.Persistence;
using DigitalSocieties.Complaint.Domain.Entities;
using DigitalSocieties.Complaint.Infrastructure.Persistence;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using DigitalSocieties.Parking.Domain.Entities;
using DigitalSocieties.Parking.Infrastructure.Persistence;
using DigitalSocieties.Shared.Domain.Enums;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Visitor.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Api.Infrastructure.Seeding;

/// <summary>Result returned from instance-based SeedAsync (used by /setup/demo endpoint).</summary>
public sealed record DemoSeedResult(Guid AdminUserId, Guid SocietyId);

/// <summary>
/// Inserts demo data on first startup in Development mode.
/// Idempotent: checks for the sentinel society registration number "DEMO-001" before inserting.
/// All data uses deterministic GUIDs so re-running is safe (no duplicates).
/// </summary>
public sealed class DataSeeder
{
    // ── Sentinel IDs — deterministic so re-runs are safe ─────────────────────
    private static readonly Guid SocietyId     = new("10000000-0000-0000-0000-000000000001");
    private static readonly Guid AdminUserId    = new("20000000-0000-0000-0000-000000000001");
    private static readonly Guid GuardUserId    = new("20000000-0000-0000-0000-000000000002");
    private static readonly Guid AccountantId   = new("20000000-0000-0000-0000-000000000003");
    private static readonly Guid StaffUserId    = new("20000000-0000-0000-0000-000000000004");

    // 10 resident user IDs
    private static readonly Guid[] ResidentIds =
    [
        new("30000000-0000-0000-0000-000000000001"),
        new("30000000-0000-0000-0000-000000000002"),
        new("30000000-0000-0000-0000-000000000003"),
        new("30000000-0000-0000-0000-000000000004"),
        new("30000000-0000-0000-0000-000000000005"),
        new("30000000-0000-0000-0000-000000000006"),
        new("30000000-0000-0000-0000-000000000007"),
        new("30000000-0000-0000-0000-000000000008"),
        new("30000000-0000-0000-0000-000000000009"),
        new("30000000-0000-0000-0000-000000000010"),
    ];

    // 10 flat IDs — A-101…A-105, B-101…B-105
    private static readonly Guid[] FlatIds =
    [
        new("40000000-0000-0000-0000-000000000001"),
        new("40000000-0000-0000-0000-000000000002"),
        new("40000000-0000-0000-0000-000000000003"),
        new("40000000-0000-0000-0000-000000000004"),
        new("40000000-0000-0000-0000-000000000005"),
        new("40000000-0000-0000-0000-000000000006"),
        new("40000000-0000-0000-0000-000000000007"),
        new("40000000-0000-0000-0000-000000000008"),
        new("40000000-0000-0000-0000-000000000009"),
        new("40000000-0000-0000-0000-000000000010"),
    ];

    // ── Resident display data ─────────────────────────────────────────────────
    private static readonly (string Phone, string Name)[] Residents =
    [
        ("+919800000001", "Amit Desai"),
        ("+919800000002", "Sunita Joshi"),
        ("+919800000003", "Vikram Nair"),
        ("+919800000004", "Kavya Reddy"),
        ("+919800000005", "Arjun Singh"),
        ("+919800000006", "Meena Iyer"),
        ("+919800000007", "Rohit Gupta"),
        ("+919800000008", "Pooja Kulkarni"),
        ("+919800000009", "Sanjay Shah"),
        ("+919800000010", "Divya Menon"),
    ];

    private static readonly (string Number, string Wing, int Floor)[] Flats =
    [
        ("101", "A", 1), ("102", "A", 1), ("103", "A", 1), ("104", "A", 1), ("105", "A", 1),
        ("101", "B", 1), ("102", "B", 1), ("103", "B", 1), ("104", "B", 1), ("105", "B", 1),
    ];

    // ─────────────────────────────────────────────────────────────────────────
    public static async Task SeedAsync(IServiceProvider services, ILogger logger)
    {
        using var scope = services.CreateScope();
        var sp = scope.ServiceProvider;

        var identityDb = sp.GetRequiredService<IdentityDbContext>();

        // ── Guard: skip if already seeded ────────────────────────────────────
        bool alreadySeeded = await identityDb.Societies
            .IgnoreQueryFilters()
            .AnyAsync(s => s.RegistrationNumber == "DEMO-001");

        if (alreadySeeded)
        {
            logger.LogInformation("[Seeder] Demo data already present — skipping.");
            return;
        }

        logger.LogInformation("[Seeder] Seeding demo data for Sunrise Heights…");

        // ── 1. Identity: Society, Users, Flats, Memberships ──────────────────
        await SeedIdentityAsync(identityDb, logger);

        // ── 2. Billing: Bills (mix of paid / pending / overdue) ──────────────
        var billingDb = sp.GetRequiredService<BillingDbContext>();
        await SeedBillingAsync(billingDb, logger);

        // ── 3. Communication: Notices ─────────────────────────────────────────
        var commDb = sp.GetRequiredService<CommunicationDbContext>();
        await SeedNoticesAsync(commDb, logger);

        // ── 4. Complaints ─────────────────────────────────────────────────────
        var complaintDb = sp.GetRequiredService<ComplaintDbContext>();
        await SeedComplaintsAsync(complaintDb, logger);

        // ── 5. Visitors ───────────────────────────────────────────────────────
        var visitorDb = sp.GetRequiredService<VisitorDbContext>();
        await SeedVisitorsAsync(visitorDb, logger);

        // ── 6. Parking: Level, Slots, Vehicles ───────────────────────────────
        var parkingDb = sp.GetRequiredService<ParkingDbContext>();
        await SeedParkingAsync(parkingDb, logger);

        logger.LogInformation("[Seeder] ✅ Demo data seeded successfully.");
    }

    // ── Instance-based entry point (used by /setup/demo endpoint) ─────────────
    // Injected as a scoped service; resolves its own DbContexts from the DI scope.
    private readonly IServiceProvider _sp;
    private readonly ILogger<DataSeeder> _logger;

    public DataSeeder(IServiceProvider sp, ILogger<DataSeeder> logger)
    {
        _sp     = sp;
        _logger = logger;
    }

    /// <summary>
    /// Seeds demo data (idempotent) and returns the demo admin and society IDs.
    /// Returns Fail if a real (non-demo) society already exists.
    /// </summary>
    public async Task<Result<DemoSeedResult>> SeedAsync(CancellationToken ct)
    {
        var identityDb = _sp.GetRequiredService<IdentityDbContext>();

        // Guard: reject if a real society exists (registration number != DEMO-001)
        bool realSocietyExists = await identityDb.Societies
            .IgnoreQueryFilters()
            .AnyAsync(s => s.RegistrationNumber != "DEMO-001", ct);

        if (realSocietyExists)
            return Result<DemoSeedResult>.Fail(
                Error.Conflict("A real society is already configured. Demo mode is only available on a fresh install."));

        bool alreadySeeded = await identityDb.Societies
            .IgnoreQueryFilters()
            .AnyAsync(s => s.RegistrationNumber == "DEMO-001", ct);

        if (!alreadySeeded)
        {
            _logger.LogInformation("[Seeder] Seeding demo data for Greenview Heights…");
            await SeedAsync(_sp, _logger);
        }
        else
        {
            _logger.LogInformation("[Seeder] Demo data already present — reusing.");
        }

        return Result<DemoSeedResult>.Ok(new DemoSeedResult(AdminUserId, SocietyId));
    }

    // ── Identity ──────────────────────────────────────────────────────────────
    private static async Task SeedIdentityAsync(IdentityDbContext db, ILogger logger)
    {
        // Society
        var society = CreateSociety();
        db.Societies.Add(society);

        // Staff users (admin, guard, accountant, maintenance staff)
        var adminUser = CreateUser(AdminUserId,   "+919999999999", "Rajesh Sharma (Admin)");
        var guardUser = CreateUser(GuardUserId,   "+919999999998", "Suresh Patil (Guard)");
        var accUser   = CreateUser(AccountantId,  "+919999999997", "Priya Mehta (Accountant)");
        var staffUser = CreateUser(StaffUserId,   "+919999999996", "Mohan Das (Staff)");

        db.Users.AddRange(adminUser, guardUser, accUser, staffUser);

        // Resident users + flats
        for (int i = 0; i < 10; i++)
        {
            var resident = CreateUser(ResidentIds[i], Residents[i].Phone, Residents[i].Name);
            db.Users.Add(resident);

            var flat = CreateFlat(FlatIds[i], SocietyId, Flats[i].Number, Flats[i].Wing, Flats[i].Floor);
            db.Flats.Add(flat);

            var membership = CreateMembership(SocietyId, ResidentIds[i], UserRole.Resident, FlatIds[i], "owner");
            db.Memberships.Add(membership);
        }

        // Staff memberships (no flat)
        db.Memberships.Add(CreateMembership(SocietyId, AdminUserId,   UserRole.Admin,       null, "staff"));
        db.Memberships.Add(CreateMembership(SocietyId, GuardUserId,   UserRole.Guard,       null, "staff"));
        db.Memberships.Add(CreateMembership(SocietyId, AccountantId,  UserRole.Accountant,  null, "staff"));
        db.Memberships.Add(CreateMembership(SocietyId, StaffUserId,   UserRole.Staff,       null, "staff"));

        await db.SaveChangesAsync();
        logger.LogInformation("[Seeder] Identity: society, {Count} users, 10 flats, memberships saved.", 14);
    }

    // ── Billing ───────────────────────────────────────────────────────────────
    private static async Task SeedBillingAsync(BillingDbContext db, ILogger logger)
    {
        var now     = DateOnly.FromDateTime(DateTime.UtcNow);
        var months  = new[]
        {
            (Period: $"{now.Year}-{now.Month:D2}",       Due: now,                        Amount: 3000m, Label: "current"),
            (Period: $"{now.AddMonths(-1).Year}-{now.AddMonths(-1).Month:D2}", Due: now.AddMonths(-1), Amount: 3000m, Label: "last"),
            (Period: $"{now.AddMonths(-2).Year}-{now.AddMonths(-2).Month:D2}", Due: now.AddMonths(-2), Amount: 3000m, Label: "two months ago"),
        };

        int billCount = 0;
        for (int fi = 0; fi < 10; fi++)
        {
            var flatId = FlatIds[fi];

            for (int mi = 0; mi < months.Length; mi++)
            {
                var m      = months[mi];
                var money  = Money.CreateInr(m.Amount).Value!;
                var bill   = Bill.Create(SocietyId, flatId, m.Period, money, m.Due,
                                         $"Monthly maintenance — {m.Period}");

                // Vary statuses for realism
                // mi=0 (current): pending
                // mi=1 (last month): flats 0-6 paid, 7-9 overdue
                // mi=2 (two months ago): all paid
                if (mi == 1 && fi >= 7)
                    bill.ApplyLateFee(Money.CreateInr(300m).Value!);   // overdue + late fee
                else if (mi == 2 || (mi == 1 && fi < 7))
                    bill.MarkPaid($"PAY_SEED_{fi}_{mi}", DateTimeOffset.UtcNow.AddDays(-(30 * (mi + 1))));

                db.Bills.Add(bill);
                billCount++;
            }
        }

        await db.SaveChangesAsync();
        logger.LogInformation("[Seeder] Billing: {Count} bills saved.", billCount);
    }

    // ── Notices ───────────────────────────────────────────────────────────────
    private static async Task SeedNoticesAsync(CommunicationDbContext db, ILogger logger)
    {
        var notices = new[]
        {
            Notice.Create(SocietyId, AdminUserId,
                "Water supply interruption — 10 Apr",
                "Water supply will be shut off on 10 April from 10 AM to 2 PM for tank cleaning. " +
                "Please store water in advance. Inconvenience is regretted.",
                NoticeType.Notice),

            Notice.Create(SocietyId, AdminUserId,
                "AGM Notice — 25 April 2026",
                "The Annual General Meeting of Sunrise Heights Residents' Welfare Association will be " +
                "held on 25 April 2026 at 7:00 PM in the Clubhouse. All flat owners are requested to " +
                "attend. Agenda: accounts approval, MC election, maintenance rate revision.",
                NoticeType.Circular),

            Notice.Create(SocietyId, AdminUserId,
                "Lift maintenance completed — A Wing",
                "The A-Wing lift has been serviced and is operational. Annual maintenance contract " +
                "renewed with M/s Otis Elevators for FY 2026-27.",
                NoticeType.Notice),

            Notice.Create(SocietyId, AdminUserId,
                "🚨 Gate camera offline — security alert",
                "The main gate CCTV camera is temporarily offline due to a power surge. " +
                "Guards have been asked to manually log all entries. Repair expected by tomorrow.",
                NoticeType.Emergency),
        };

        // Pin the emergency notice
        notices[3].Pin();

        db.Notices.AddRange(notices);
        await db.SaveChangesAsync();
        logger.LogInformation("[Seeder] Communication: {Count} notices saved.", notices.Length);
    }

    // ── Complaints ────────────────────────────────────────────────────────────
    private static async Task SeedComplaintsAsync(ComplaintDbContext db, ILogger logger)
    {
        // Open
        var c1 = DigitalSocieties.Complaint.Domain.Entities.Complaint.Create(
            SocietyId, FlatIds[0], ResidentIds[0],
            "Corridor light not working — A Wing 1st floor",
            "The tube light in the A Wing 1st floor corridor near the lift has been off for 3 days.",
            "Electrical", Priority.Medium);

        // Assigned
        var c2 = DigitalSocieties.Complaint.Domain.Entities.Complaint.Create(
            SocietyId, FlatIds[2], ResidentIds[2],
            "Water leakage from terrace — flat A-103",
            "Heavy rain has caused water seepage through the terrace into the bedroom ceiling. " +
            "Paint is peeling and there is risk of short circuit.",
            "Civil / Waterproofing", Priority.High);
        c2.Assign(StaffUserId, "Assigned to civil maintenance team for inspection.");

        // In Progress
        var c3 = DigitalSocieties.Complaint.Domain.Entities.Complaint.Create(
            SocietyId, FlatIds[5], ResidentIds[5],
            "Common area gym equipment broken — treadmill",
            "The main treadmill in the gym has a faulty belt. It was reported 2 weeks ago.",
            "Facility", Priority.Low);
        c3.Assign(StaffUserId);
        c3.StartWork(StaffUserId);

        // Resolved
        var c4 = DigitalSocieties.Complaint.Domain.Entities.Complaint.Create(
            SocietyId, FlatIds[1], ResidentIds[1],
            "Parking area lights dim — B1 basement",
            "The basement parking has 4 bulbs that are very dim / flickering. Safety concern at night.",
            "Electrical", Priority.Medium);
        c4.Assign(StaffUserId);
        c4.StartWork(StaffUserId);
        c4.Resolve(StaffUserId, "All 4 LED lights replaced. Verified by resident on 22 Apr.");

        // Closed
        var c5 = DigitalSocieties.Complaint.Domain.Entities.Complaint.Create(
            SocietyId, FlatIds[4], ResidentIds[4],
            "Neighbour noise complaint — late night",
            "Loud music from flat B-103 every Friday night after midnight.",
            "Dispute", Priority.Urgent);
        c5.Assign(AdminUserId, "MC member will speak with concerned resident.");
        c5.StartWork(AdminUserId);
        c5.Resolve(AdminUserId, "Verbal warning issued. Resident agreed to maintain quiet hours.");
        c5.Close(AdminUserId);

        db.Complaints.AddRange(c1, c2, c3, c4, c5);
        await db.SaveChangesAsync();
        logger.LogInformation("[Seeder] Complaints: 5 saved (Open / Assigned / InProgress / Resolved / Closed).");
    }

    // ── Visitors ──────────────────────────────────────────────────────────────
    private static async Task SeedVisitorsAsync(VisitorDbContext db, ILogger logger)
    {
        // Pending (guard just logged, resident hasn't responded)
        var v1 = DigitalSocieties.Visitor.Domain.Entities.Visitor.Create(
            SocietyId, FlatIds[0], "Swiggy Delivery", "+919500000001", "Delivery", GuardUserId);

        // Approved (resident approved, visitor inside)
        var v2 = DigitalSocieties.Visitor.Domain.Entities.Visitor.Create(
            SocietyId, FlatIds[2], "Karan Mehta", "+919500000002", "Personal Visit", GuardUserId);
        v2.Approve(ResidentIds[2], "VISITOR_QR_SEED_001");
        v2.MarkEntered();

        // Exited (complete flow)
        var v3 = DigitalSocieties.Visitor.Domain.Entities.Visitor.Create(
            SocietyId, FlatIds[5], "Urban Company Technician", "+919500000003", "Home Service", GuardUserId);
        v3.Approve(ResidentIds[5], "VISITOR_QR_SEED_002");
        v3.MarkEntered();
        v3.MarkExited();

        // Rejected
        var v4 = DigitalSocieties.Visitor.Domain.Entities.Visitor.Create(
            SocietyId, FlatIds[7], "Unknown Salesperson", null, "Sales", GuardUserId);
        v4.Reject(ResidentIds[7], "Not expecting anyone. Please send away.");

        // Exited (courier)
        var v5 = DigitalSocieties.Visitor.Domain.Entities.Visitor.Create(
            SocietyId, FlatIds[3], "Amazon Delivery", "+919500000005", "Delivery", GuardUserId);
        v5.Approve(ResidentIds[3], "VISITOR_QR_SEED_003");
        v5.MarkEntered();
        v5.MarkExited();

        db.Visitors.AddRange(v1, v2, v3, v4, v5);
        await db.SaveChangesAsync();
        logger.LogInformation("[Seeder] Visitors: 5 saved (Pending / Entered / Exited / Rejected / Exited).");
    }

    // ── Parking ───────────────────────────────────────────────────────────────
    private static async Task SeedParkingAsync(ParkingDbContext db, ILogger logger)
    {
        // One basement level — use whatever ID EF assigns, then reference it for slots
        var level = ParkingLevel.Create(SocietyId, "Basement B1", -1);
        db.ParkingLevels.Add(level);
        await db.SaveChangesAsync();   // saves level, level.Id is now set
        var levelId = level.Id;

        var slots = new List<ParkingSlot>();

        // Car slots B1-001…B1-010
        for (int i = 1; i <= 10; i++)
            slots.Add(ParkingSlot.Create(SocietyId, levelId, $"B1-{i:D3}", SlotType.Car));

        // Bike slots B1-B01…B1-B04
        for (int i = 1; i <= 4; i++)
            slots.Add(ParkingSlot.Create(SocietyId, levelId, $"B1-B{i:D2}", SlotType.Bike));

        // EV slots with charger
        slots.Add(ParkingSlot.Create(SocietyId, levelId, "B1-EV01", SlotType.Car, isEvCharger: true));
        slots.Add(ParkingSlot.Create(SocietyId, levelId, "B1-EV02", SlotType.Car, isEvCharger: true));

        // Assign first 5 car slots to flats 0–4
        var carPlates = new[] { "MH12AB1001", "MH12CD2002", "MH12EF3003", "MH14GH4004", "MH14IJ5005" };
        for (int i = 0; i < 5; i++)
            slots[i].AssignToFlat(FlatIds[i], carPlates[i], "Car");

        // Assign 2 bike slots to flats 5–6
        slots[10].AssignToFlat(FlatIds[5], "MH12KL6006", "Bike");
        slots[11].AssignToFlat(FlatIds[6], "MH12MN7007", "Bike");

        db.ParkingSlots.AddRange(slots);

        // Registered vehicles
        db.Vehicles.AddRange(
            Vehicle.Register(SocietyId, FlatIds[0], "MH12AB1001", "Car",  "Maruti Swift",           "White"),
            Vehicle.Register(SocietyId, FlatIds[1], "MH12CD2002", "Car",  "Honda City",             "Silver"),
            Vehicle.Register(SocietyId, FlatIds[2], "MH12EF3003", "Car",  "Hyundai Creta",          "Grey"),
            Vehicle.Register(SocietyId, FlatIds[3], "MH14GH4004", "Car",  "Tata Nexon EV",          "Blue"),
            Vehicle.Register(SocietyId, FlatIds[4], "MH14IJ5005", "Car",  "Kia Seltos",             "Red"),
            Vehicle.Register(SocietyId, FlatIds[5], "MH12KL6006", "Bike", "Royal Enfield Classic 350", "Black"),
            Vehicle.Register(SocietyId, FlatIds[6], "MH12MN7007", "Bike", "Honda Activa 6G",        "Blue")
        );

        await db.SaveChangesAsync();
        logger.LogInformation("[Seeder] Parking: 1 level, {Slots} slots, 7 vehicles saved.", slots.Count);
    }

    // ── Domain factory helpers ────────────────────────────────────────────────

    private static Society CreateSociety()
    {
        var s = Society.Create(
            "Sunrise Heights",
            "Plot 42, Baner Road, Pune 411045, Maharashtra",
            "DEMO-001");
        SetId(s, SocietyId);
        return s;
    }

    private static User CreateUser(Guid id, string phone, string name)
    {
        var phoneResult = PhoneNumber.Create(phone);
        if (phoneResult.IsFailure)
            throw new InvalidOperationException($"Invalid seed phone {phone}: {phoneResult.Error!.Message}");

        var user = User.Create(phoneResult.Value!, name);
        SetId(user, id);
        user.MarkVerified();   // skip OTP for seed users
        return user;
    }

    private static Flat CreateFlat(Guid id, Guid societyId, string number, string wing, int floor)
    {
        var flat = Flat.Create(societyId, number, wing, floor);
        SetId(flat, id);
        return flat;
    }

    private static Membership CreateMembership(
        Guid societyId, Guid userId, string role, Guid? flatId, string memberType)
        => Membership.Create(userId, societyId, role, flatId, memberType);

    /// <summary>
    /// Overwrites the <c>Entity.Id</c> property (which has <c>protected init</c>) using
    /// reflection so the seeder can assign deterministic GUIDs. This bypasses the
    /// compile-time <c>init</c> restriction — intentional here, never use in prod code.
    /// </summary>
    private static void SetId(DigitalSocieties.Shared.Domain.Entities.Entity entity, Guid id)
    {
        var prop = typeof(DigitalSocieties.Shared.Domain.Entities.Entity)
            .GetProperty(
                nameof(DigitalSocieties.Shared.Domain.Entities.Entity.Id),
                System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);

        // init setters are protected; GetSetMethod(nonPublic:true) surfaces them for reflection.
        var setter = prop?.GetSetMethod(nonPublic: true)
                     ?? prop?.GetSetMethod(nonPublic: false);

        if (setter is null)
            throw new InvalidOperationException(
                $"Could not locate a setter for Entity.Id on {entity.GetType().Name}. " +
                "Check if the property definition changed.");

        setter.Invoke(entity, [id]);
    }
}
