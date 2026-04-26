using MediatR;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Calling.Domain.Contracts;
using DigitalSocieties.Calling.Domain.Entities;
using DigitalSocieties.Calling.Infrastructure.Persistence;

namespace DigitalSocieties.Calling.Application.Commands;

// ── DTOs shared across commands ────────────────────────────────────────────
public sealed record CallRoomDto(
    Guid   RoomId,
    string RoomName,
    string Token,
    string ServerUrl,
    string Provider,
    DateTimeOffset ExpiresAt);

// ── Create visitor callback room ───────────────────────────────────────────
public sealed record CreateVisitorCallCommand(Guid VisitorId)
    : IRequest<Result<CallRoomDto>>;

public sealed class CreateVisitorCallHandler
    : IRequestHandler<CreateVisitorCallCommand, Result<CallRoomDto>>
{
    private readonly CallingDbContext    _db;
    private readonly IVideoCallProvider  _provider;
    private readonly ICurrentUser        _cu;

    public CreateVisitorCallHandler(CallingDbContext db, IVideoCallProvider provider, ICurrentUser cu)
        => (_db, _provider, _cu) = (db, provider, cu);

    public async Task<Result<CallRoomDto>> Handle(CreateVisitorCallCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is null || _cu.UserId is null)
            return Result<CallRoomDto>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var room = CallRoom.Create(
            societyId:       _cu.SocietyId.Value,
            type:            CallRoomType.VisitorCallback,
            ttl:             TimeSpan.FromMinutes(10),
            linkedVisitorId: cmd.VisitorId);

        await _provider.CreateRoomAsync(room.RoomName, emptyTimeout: TimeSpan.FromMinutes(5), ct);
        room.AddParticipant(_cu.UserId.Value, "Resident", CallRole.Host);

        _db.CallRooms.Add(room);
        await _db.SaveChangesAsync(ct);

        var token = await _provider.GenerateTokenAsync(
            roomName:            room.RoomName,
            participantIdentity: _cu.UserId.Value.ToString(),
            participantName:     "Resident",
            canPublish:          true,
            canSubscribe:        true,
            ttl:                 TimeSpan.FromMinutes(10),
            ct:                  ct);

        return Result<CallRoomDto>.Ok(new CallRoomDto(
            room.Id, room.RoomName, token.Token, token.ServerUrl, token.ProviderName, room.ExpiresAt));
    }
}

// ── Create SOS broadcast room ──────────────────────────────────────────────
public sealed record CreateSosCallCommand : IRequest<Result<CallRoomDto>>;

public sealed class CreateSosCallHandler
    : IRequestHandler<CreateSosCallCommand, Result<CallRoomDto>>
{
    private readonly CallingDbContext    _db;
    private readonly IVideoCallProvider  _provider;
    private readonly ICurrentUser        _cu;

    public CreateSosCallHandler(CallingDbContext db, IVideoCallProvider provider, ICurrentUser cu)
        => (_db, _provider, _cu) = (db, provider, cu);

    public async Task<Result<CallRoomDto>> Handle(CreateSosCallCommand _, CancellationToken ct)
    {
        if (_cu.SocietyId is null || _cu.FlatId is null || _cu.UserId is null)
            return Result<CallRoomDto>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var room = CallRoom.Create(
            societyId:       _cu.SocietyId.Value,
            type:            CallRoomType.Sos,
            ttl:             TimeSpan.FromMinutes(30),
            initiatorFlatId: _cu.FlatId.Value);

        // SOS rooms are one-way: resident publishes, guards/neighbors observe.
        await _provider.CreateRoomAsync(room.RoomName, emptyTimeout: TimeSpan.FromMinutes(5), ct);
        room.AddParticipant(_cu.UserId.Value, "SOS Initiator", CallRole.Host);
        room.MarkActive();

        _db.CallRooms.Add(room);
        await _db.SaveChangesAsync(ct);

        var token = await _provider.GenerateTokenAsync(
            roomName:            room.RoomName,
            participantIdentity: _cu.UserId.Value.ToString(),
            participantName:     "SOS",
            canPublish:          true,   // initiator streams video/audio
            canSubscribe:        false,
            ttl:                 TimeSpan.FromMinutes(30),
            ct:                  ct);

        return Result<CallRoomDto>.Ok(new CallRoomDto(
            room.Id, room.RoomName, token.Token, token.ServerUrl, token.ProviderName, room.ExpiresAt));
    }
}

// ── Join an existing room (guard / neighbor obtains observer token) ─────────
public sealed record JoinCallCommand(Guid RoomId) : IRequest<Result<CallRoomDto>>;

public sealed class JoinCallHandler : IRequestHandler<JoinCallCommand, Result<CallRoomDto>>
{
    private readonly CallingDbContext    _db;
    private readonly IVideoCallProvider  _provider;
    private readonly ICurrentUser        _cu;

    public JoinCallHandler(CallingDbContext db, IVideoCallProvider provider, ICurrentUser cu)
        => (_db, _provider, _cu) = (db, provider, cu);

    public async Task<Result<CallRoomDto>> Handle(JoinCallCommand cmd, CancellationToken ct)
    {
        if (_cu.UserId is null)
            return Result<CallRoomDto>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var room = await _db.CallRooms.FindAsync([cmd.RoomId], ct);
        if (room is null)
            return Result<CallRoomDto>.Fail("ROOM.NOT_FOUND", "Call room not found.");

        if (room.IsExpired() || room.Status == CallRoomStatus.Ended)
            return Result<CallRoomDto>.Fail("ROOM.CLOSED", "This call has already ended.");

        var isSos      = room.Type == CallRoomType.Sos;
        var canPublish = !isSos; // SOS observers can only subscribe

        var role = isSos ? CallRole.Observer : CallRole.Participant;
        room.AddParticipant(_cu.UserId.Value, _cu.UserId.Value.ToString(), role);
        await _db.SaveChangesAsync(ct);

        var token = await _provider.GenerateTokenAsync(
            roomName:            room.RoomName,
            participantIdentity: _cu.UserId.Value.ToString(),
            participantName:     role.ToString(),
            canPublish:          canPublish,
            canSubscribe:        true,
            ttl:                 TimeSpan.FromMinutes(30),
            ct:                  ct);

        return Result<CallRoomDto>.Ok(new CallRoomDto(
            room.Id, room.RoomName, token.Token, token.ServerUrl, token.ProviderName, room.ExpiresAt));
    }
}

// ── End a room (host ends the call) ───────────────────────────────────────
public sealed record EndCallCommand(Guid RoomId) : IRequest<Result>;

public sealed class EndCallHandler : IRequestHandler<EndCallCommand, Result>
{
    private readonly CallingDbContext   _db;
    private readonly IVideoCallProvider _provider;
    private readonly ICurrentUser       _cu;

    public EndCallHandler(CallingDbContext db, IVideoCallProvider provider, ICurrentUser cu)
        => (_db, _provider, _cu) = (db, provider, cu);

    public async Task<Result> Handle(EndCallCommand cmd, CancellationToken ct)
    {
        var room = await _db.CallRooms.FindAsync([cmd.RoomId], ct);
        if (room is null)
            return Result.Fail("ROOM.NOT_FOUND", "Call room not found.");

        await _provider.DeleteRoomAsync(room.RoomName, ct);
        room.MarkEnded();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
