using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Social.Domain.Entities;

namespace DigitalSocieties.Social.Infrastructure.Persistence;

/// <summary>
/// EF Core context for the social schema.
/// All tables live under the "social" Postgres schema for clean multi-module isolation.
/// RLS is enforced via session variable app.current_society_id (set by TenantResolutionMiddleware).
/// </summary>
public sealed class SocialDbContext(DbContextOptions<SocialDbContext> options)
    : DbContext(options)
{
    public DbSet<SocialPost>         Posts    => Set<SocialPost>();
    public DbSet<PostComment>        Comments => Set<PostComment>();
    public DbSet<PostReaction>       Reactions => Set<PostReaction>();
    public DbSet<SocialGroup>        Groups   => Set<SocialGroup>();
    public DbSet<GroupMember>        GroupMembers => Set<GroupMember>();
    public DbSet<SocialPoll>         Polls    => Set<SocialPoll>();
    public DbSet<PollVote>           PollVotes => Set<PollVote>();
    public DbSet<MarketplaceListing> Listings => Set<MarketplaceListing>();
    public DbSet<DirectoryEntry>     Directory => Set<DirectoryEntry>();
    public DbSet<PostReport>         Reports  => Set<PostReport>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        // ── Schema ───────────────────────────────────────────────────────────
        model.HasDefaultSchema("social");

        // ── SocialPost ───────────────────────────────────────────────────────
        model.Entity<SocialPost>(e =>
        {
            e.ToTable("posts");
            e.HasKey(p => p.Id);
            e.Property(p => p.Body).HasMaxLength(1000).IsRequired();
            e.Property(p => p.Category).HasMaxLength(30).IsRequired();
            e.Property(p => p.ImageUrls)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null)!);
            e.HasQueryFilter(p => !p.IsDeleted);
            e.HasMany(p => p.Comments).WithOne().HasForeignKey(c => c.PostId);
            e.HasMany(p => p.Reactions).WithOne().HasForeignKey(r => r.PostId);
        });

        // ── PostComment ───────────────────────────────────────────────────────
        model.Entity<PostComment>(e =>
        {
            e.ToTable("comments");
            e.HasKey(c => c.Id);
            e.Property(c => c.Body).HasMaxLength(500).IsRequired();
        });

        // ── PostReaction — unique per (post, user) ────────────────────────────
        model.Entity<PostReaction>(e =>
        {
            e.ToTable("post_reactions");
            e.HasKey(r => r.Id);
            e.HasIndex(r => new { r.PostId, r.UserId }).IsUnique();
            e.Property(r => r.Type).HasMaxLength(20).IsRequired();
        });

        // ── SocialGroup ───────────────────────────────────────────────────────
        model.Entity<SocialGroup>(e =>
        {
            e.ToTable("groups");
            e.HasKey(g => g.Id);
            e.Property(g => g.Name).HasMaxLength(80).IsRequired();
            e.HasMany(g => g.Members).WithOne().HasForeignKey(m => m.GroupId);
        });

        model.Entity<GroupMember>(e =>
        {
            e.ToTable("group_members");
            e.HasKey(m => m.Id);
            e.HasIndex(m => new { m.GroupId, m.UserId }).IsUnique();
        });

        // ── SocialPoll ────────────────────────────────────────────────────────
        model.Entity<SocialPoll>(e =>
        {
            e.ToTable("polls");
            e.HasKey(p => p.Id);
            e.Property(p => p.Question).HasMaxLength(300).IsRequired();
            e.Property(p => p.Options)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<PollOption>>(v, (System.Text.Json.JsonSerializerOptions?)null)!);
            e.HasMany(p => p.Votes).WithOne().HasForeignKey(v => v.PollId);
        });

        model.Entity<PollVote>(e =>
        {
            e.ToTable("poll_votes");
            e.HasKey(v => v.Id);
            e.HasIndex(v => new { v.PollId, v.UserId }).IsUnique();
            e.Property(v => v.OptionIds)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<Guid>>(v, (System.Text.Json.JsonSerializerOptions?)null)!);
        });

        // ── MarketplaceListing ────────────────────────────────────────────────
        model.Entity<MarketplaceListing>(e =>
        {
            e.ToTable("marketplace_listings");
            e.HasKey(l => l.Id);
            e.Property(l => l.Condition).HasMaxLength(20).IsRequired();
        });

        // ── DirectoryEntry ────────────────────────────────────────────────────
        model.Entity<DirectoryEntry>(e =>
        {
            e.ToTable("directory_entries");
            e.HasKey(d => d.Id);
            e.HasIndex(d => new { d.UserId, d.SocietyId }).IsUnique();
            e.Property(d => d.DisplayName).HasMaxLength(80).IsRequired();
            e.Property(d => d.Bio).HasMaxLength(150);
        });

        // ── PostReport ────────────────────────────────────────────────────────
        model.Entity<PostReport>(e =>
        {
            e.ToTable("reports");
            e.HasKey(r => r.Id);
            e.Property(r => r.Status).HasMaxLength(20);
        });
    }
}
