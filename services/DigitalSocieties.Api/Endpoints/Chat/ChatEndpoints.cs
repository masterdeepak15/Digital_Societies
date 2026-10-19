using MediatR;
using DigitalSocieties.Communication.Application.Commands;
using DigitalSocieties.Communication.Application.Queries;

namespace DigitalSocieties.Api.Endpoints.Chat;

/// <summary>Chat between neighbours. Every handler checks that the caller is in the conversation; there is no admin override.</summary>
public static class ChatEndpoints
{
    public static RouteGroupBuilder MapChatEndpoints(this RouteGroupBuilder g)
    {
        g.MapGet("/conversations", async (IMediator m, CancellationToken ct) =>
        {
            var r = await m.Send(new GetConversationsQuery(), ct);
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapPost("/conversations/direct", async (IMediator m, DirectBody b, CancellationToken ct) =>
        {
            var r = await m.Send(new StartDirectChatCommand(b.OtherUserId), ct);
            return r.IsSuccess ? Results.Ok(new { id = r.Value }) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapPost("/conversations/group", async (IMediator m, GroupBody b, CancellationToken ct) =>
        {
            var r = await m.Send(new CreateGroupCommand(b.Title, b.MemberUserIds ?? new()), ct);
            return r.IsSuccess ? Results.Ok(new { id = r.Value }) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapGet("/conversations/{id:guid}/members", async (IMediator m, Guid id, CancellationToken ct) =>
        {
            var r = await m.Send(new GetConversationMembersQuery(id), ct);
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapPost("/conversations/{id:guid}/members", async (IMediator m, Guid id, MembersBody b, CancellationToken ct) =>
        {
            var r = await m.Send(new AddGroupMembersCommand(id, b.UserIds ?? new()), ct);
            return r.IsSuccess ? Results.NoContent() : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapPost("/conversations/{id:guid}/leave", async (IMediator m, Guid id, CancellationToken ct) =>
        {
            var r = await m.Send(new LeaveConversationCommand(id), ct);
            return r.IsSuccess ? Results.NoContent() : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapGet("/conversations/{id:guid}/messages", async (IMediator m, Guid id, DateTimeOffset? before, CancellationToken ct, int limit = 40) =>
        {
            var r = await m.Send(new GetChatMessagesQuery(id, before, limit), ct);
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapPost("/conversations/{id:guid}/messages", async (IMediator m, Guid id, SendBody b, CancellationToken ct) =>
        {
            var r = await m.Send(new SendChatMessageCommand(id, b.ClientId, b.Kind ?? "Text", b.Body ?? string.Empty, b.MediaId), ct);
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapPost("/conversations/{id:guid}/read", async (IMediator m, Guid id, CancellationToken ct) =>
        {
            var r = await m.Send(new MarkChatReadCommand(id), ct);
            return r.IsSuccess ? Results.NoContent() : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        // The phone got the messages (all conversations, or one).
        g.MapPost("/delivered", async (IMediator m, CancellationToken ct) =>
        {
            var r = await m.Send(new MarkChatDeliveredCommand(null), ct);
            return r.IsSuccess ? Results.NoContent() : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapPost("/conversations/{id:guid}/delivered", async (IMediator m, Guid id, CancellationToken ct) =>
        {
            var r = await m.Send(new MarkChatDeliveredCommand(id), ct);
            return r.IsSuccess ? Results.NoContent() : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapGet("/people", async (IMediator m, string? search, CancellationToken ct) =>
        {
            var r = await m.Send(new GetChatPeopleQuery(search), ct);
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        // ?ids=guid,guid,...
        g.MapGet("/presence", async (IMediator m, string? ids, CancellationToken ct) =>
        {
            var list = (ids ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => Guid.TryParse(s, out var id) ? id : (Guid?)null).Where(i => i.HasValue).Select(i => i!.Value).ToList();
            var r = await m.Send(new GetPresenceQuery(list), ct);
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        return g;
    }

    private sealed record DirectBody(Guid OtherUserId);
    private sealed record GroupBody(string Title, List<Guid>? MemberUserIds);
    private sealed record MembersBody(List<Guid>? UserIds);
    private sealed record SendBody(Guid ClientId, string? Kind, string? Body, string? MediaId);
}
