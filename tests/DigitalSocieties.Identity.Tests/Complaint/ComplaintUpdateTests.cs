using Xunit;
using FluentAssertions;
using NSubstitute;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Complaint.Application.Commands;
using DigitalSocieties.Complaint.Infrastructure.Persistence;
using ComplaintEntity = DigitalSocieties.Complaint.Domain.Entities.Complaint;
using DigitalSocieties.Complaint.Domain.Entities;

namespace DigitalSocieties.Identity.Tests.Complaint;

public class ComplaintUpdateTests
{
    private static readonly string Hash = new('b', 64);

    private static (ComplaintDbContext db, ComplaintEntity complaint) Seed()
    {
        var opts = new DbContextOptionsBuilder<ComplaintDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var db = new ComplaintDbContext(opts, Substitute.For<ICurrentUser>());
        var c = ComplaintEntity.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Leak", "Tap leaks", "Plumbing", Priority.Low);
        db.Complaints.Add(c);
        db.SaveChanges();
        return (db, c);
    }

    private static AddComplaintUpdateHandler Handler(ComplaintDbContext db) => new(db);

    [Fact] public async Task Note_WithPictures_IsAddedWithoutChangingStatus()
    {
        var (db, c) = Seed();
        var by = Guid.NewGuid();

        var r = await Handler(db).Handle(new AddComplaintUpdateCommand(c.Id, by, "Checked the pipe", [Hash]), default);

        r.IsSuccess.Should().BeTrue();
        var saved = await db.Complaints.Include(x => x.Updates).SingleAsync();
        saved.Status.Should().Be(ComplaintStatus.Open);
        var note = saved.Updates.Single();
        note.Comment.Should().Be("Checked the pipe");
        note.UpdatedBy.Should().Be(by);
        note.MediaIdsJson.Should().Contain(Hash);
    }

    [Fact] public async Task StatusChange_WritesTheTransitionAndTheNote()
    {
        var (db, c) = Seed();

        await Handler(db).Handle(new AddComplaintUpdateCommand(c.Id, Guid.NewGuid(), "Fixed it", [Hash], "Resolved"), default);

        var saved = await db.Complaints.Include(x => x.Updates).SingleAsync();
        saved.Status.Should().Be(ComplaintStatus.Resolved);
        saved.Updates.Should().HaveCount(2);                       // "Resolved" line + the note with its picture
        saved.Updates.Count(u => u.MediaIdsJson != null).Should().Be(1);
    }

    [Fact] public async Task UnknownComplaint_Fails()
    {
        var (db, _) = Seed();
        var r = await Handler(db).Handle(new AddComplaintUpdateCommand(Guid.NewGuid(), Guid.NewGuid(), "x"), default);
        r.IsSuccess.Should().BeFalse();
    }

    [Fact] public void Validator_RequiresANote_AndRejectsBadPictureIdsOrStatus()
    {
        var v = new AddComplaintUpdateValidator();
        v.Validate(new AddComplaintUpdateCommand(Guid.NewGuid(), Guid.NewGuid(), "ok", [Hash], "InProgress")).IsValid.Should().BeTrue();
        v.Validate(new AddComplaintUpdateCommand(Guid.NewGuid(), Guid.NewGuid(), "")).IsValid.Should().BeFalse();
        v.Validate(new AddComplaintUpdateCommand(Guid.NewGuid(), Guid.NewGuid(), "ok", ["../x"])).IsValid.Should().BeFalse();
        v.Validate(new AddComplaintUpdateCommand(Guid.NewGuid(), Guid.NewGuid(), "ok", null, "Deleted")).IsValid.Should().BeFalse();
        v.Validate(new AddComplaintUpdateCommand(Guid.NewGuid(), Guid.NewGuid(), "ok", Enumerable.Repeat(Hash, 7).ToList())).IsValid.Should().BeFalse();
    }
}
