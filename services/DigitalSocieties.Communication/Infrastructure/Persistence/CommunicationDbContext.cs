using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Communication.Domain.Entities;
using DigitalSocieties.Communication.Infrastructure.Push;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Communication.Infrastructure.Persistence;

public sealed class CommunicationDbContext : DbContext
{
    private readonly ICurrentUser _cu;
    public CommunicationDbContext(DbContextOptions<CommunicationDbContext> opts, ICurrentUser cu)
        : base(opts) => _cu = cu;

    public DbSet<Notice>    Notices    => Set<Notice>();
    public DbSet<PushToken> PushTokens => Set<PushToken>();

    // Chat
    public DbSet<Conversation>       Conversations       => Set<Conversation>();
    public DbSet<ConversationMember> ConversationMembers => Set<ConversationMember>();
    public DbSet<ChatMessage>        ChatMessages        => Set<ChatMessage>();
    public DbSet<UserPresence>       UserPresences       => Set<UserPresence>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasDefaultSchema("communication");

        mb.Entity<Notice>(b =>
        {
            b.ToTable("notices");
            b.HasKey(e => e.Id);
            b.Property(e => e.Title).HasMaxLength(300).IsRequired();
            b.Property(e => e.Body).IsRequired();
            b.Property(e => e.Type).HasConversion<string>().HasMaxLength(20);
            b.HasIndex(e => new { e.SocietyId, e.CreatedAt });
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        mb.Entity<PushToken>(b =>
        {
            b.ToTable("push_tokens");
            b.HasKey(e => e.Id);
            b.Property(e => e.UserId).HasColumnName("user_id").IsRequired();
            b.Property(e => e.SocietyId).HasColumnName("society_id").IsRequired();
            b.Property(e => e.ExpoPushToken).HasColumnName("expo_push_token")
                .HasMaxLength(200).IsRequired();
            b.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
            b.Property(e => e.CreatedAt).HasColumnName("created_at");
            b.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            b.HasIndex(e => e.UserId).HasDatabaseName("ix_push_tokens_user_id");
            b.HasIndex(e => e.ExpoPushToken)
                .HasDatabaseName("ix_push_tokens_expo_token").IsUnique();
        });
        MapChat(mb);
    }

    private static void MapChat(ModelBuilder mb)
    {
        mb.Entity<Conversation>(b =>
        {
            b.ToTable("conversations");
            b.HasKey(e => e.Id);
            b.HasQueryFilter(e => !e.IsDeleted);
            b.Property(e => e.Id).HasColumnName("id");
            b.Property(e => e.SocietyId).HasColumnName("society_id");
            b.Property(e => e.Type).HasColumnName("type").HasConversion<string>().HasMaxLength(10);
            b.Property(e => e.Title).HasColumnName("title").HasMaxLength(100);
            b.Property(e => e.DirectKey).HasColumnName("direct_key").HasMaxLength(80);
            b.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
            b.Property(e => e.LastMessageAt).HasColumnName("last_message_at");
            b.Property(e => e.LastMessagePreview).HasColumnName("last_message_preview").HasMaxLength(200);
            b.Property(e => e.LastMessageSenderId).HasColumnName("last_message_sender_id");
            b.Property(e => e.CreatedAt).HasColumnName("created_at");
            b.Property(e => e.CreatedBy).HasColumnName("created_by");
            b.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            b.Property(e => e.UpdatedBy).HasColumnName("updated_by");
            b.Property("IsDeleted").HasColumnName("is_deleted").HasDefaultValue(false);
            b.HasIndex(e => new { e.SocietyId, e.DirectKey }).IsUnique().HasDatabaseName("ux_conversations_direct")
                .HasFilter("direct_key IS NOT NULL");
        });

        mb.Entity<ConversationMember>(b =>
        {
            b.ToTable("conversation_members");
            b.HasKey(e => e.Id);
            b.HasQueryFilter(e => !e.IsDeleted);
            b.Ignore(e => e.IsActive);
            b.Property(e => e.Id).HasColumnName("id");
            b.Property(e => e.ConversationId).HasColumnName("conversation_id");
            b.Property(e => e.UserId).HasColumnName("user_id");
            b.Property(e => e.IsAdmin).HasColumnName("is_admin");
            b.Property(e => e.JoinedAt).HasColumnName("joined_at");
            b.Property(e => e.LeftAt).HasColumnName("left_at");
            b.Property(e => e.LastDeliveredAt).HasColumnName("last_delivered_at");
            b.Property(e => e.LastReadAt).HasColumnName("last_read_at");
            b.Property(e => e.CreatedAt).HasColumnName("created_at");
            b.Property(e => e.CreatedBy).HasColumnName("created_by");
            b.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            b.Property(e => e.UpdatedBy).HasColumnName("updated_by");
            b.Property("IsDeleted").HasColumnName("is_deleted").HasDefaultValue(false);
            b.HasIndex(e => new { e.ConversationId, e.UserId }).IsUnique().HasDatabaseName("ux_conversation_members");
            b.HasIndex(e => e.UserId).HasDatabaseName("ix_conversation_members_user");
        });

        mb.Entity<ChatMessage>(b =>
        {
            b.ToTable("chat_messages");
            b.HasKey(e => e.Id);
            b.HasQueryFilter(e => !e.IsDeleted);
            b.Property(e => e.Id).HasColumnName("id");
            b.Property(e => e.SocietyId).HasColumnName("society_id");
            b.Property(e => e.ConversationId).HasColumnName("conversation_id");
            b.Property(e => e.SenderUserId).HasColumnName("sender_user_id");
            b.Property(e => e.ClientId).HasColumnName("client_id");
            b.Property(e => e.Kind).HasColumnName("kind").HasConversion<string>().HasMaxLength(10);
            b.Property(e => e.Body).HasColumnName("body").HasMaxLength(ChatMessage.MaxBody);
            b.Property(e => e.MediaId).HasColumnName("media_id").HasMaxLength(100);
            b.Property(e => e.SentAt).HasColumnName("sent_at");
            b.Property(e => e.CreatedAt).HasColumnName("created_at");
            b.Property(e => e.CreatedBy).HasColumnName("created_by");
            b.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            b.Property(e => e.UpdatedBy).HasColumnName("updated_by");
            b.Property("IsDeleted").HasColumnName("is_deleted").HasDefaultValue(false);
            b.HasIndex(e => new { e.ConversationId, e.SentAt }).HasDatabaseName("ix_chat_messages_conversation_sent");
            b.HasIndex(e => new { e.SenderUserId, e.ClientId }).IsUnique().HasDatabaseName("ux_chat_messages_client");
        });

        mb.Entity<UserPresence>(b =>
        {
            b.ToTable("user_presence");
            b.HasKey(e => e.UserId);
            b.Property(e => e.UserId).HasColumnName("user_id");
            b.Property(e => e.LastSeenAt).HasColumnName("last_seen_at");
        });
    }

    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var e in ChangeTracker.Entries<Shared.Domain.Entities.AuditableEntity>())
        {
            if (e.State == EntityState.Added)    { e.Entity.CreatedAt = now; e.Entity.CreatedBy = _cu.UserId; e.Entity.UpdatedAt = now; }
            if (e.State == EntityState.Modified)  { e.Entity.UpdatedAt = now; e.Entity.UpdatedBy = _cu.UserId; }
        }
        return await base.SaveChangesAsync(ct);
    }
}
