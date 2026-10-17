using MediatR;
using FluentValidation;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Identity.Infrastructure.Persistence;

namespace DigitalSocieties.Identity.Application.Commands;

// ── Set / clear the optional phone number ────────────────────────────────────
/// <summary>Null or blank clears the phone. No verification: there is no free channel for it.</summary>
public sealed record SetPhoneCommand(string? Phone) : IRequest<Result>;

public sealed class SetPhoneCommandHandler : IRequestHandler<SetPhoneCommand, Result>
{
    private readonly ICurrentUser    _me;
    private readonly IUserRepository _users;
    private readonly IUnitOfWork     _uow;

    public SetPhoneCommandHandler(ICurrentUser me, IUserRepository users, IUnitOfWork uow)
    {
        _me = me; _users = users; _uow = uow;
    }

    public async Task<Result> Handle(SetPhoneCommand request, CancellationToken ct)
    {
        if (!_me.IsAuthenticated || _me.UserId is null)
            return Result.Fail(Error.Unauthorized());

        var user = await _users.FindByIdAsync(_me.UserId.Value, ct);
        if (user is null)
            return Result.Fail(Error.NotFound("User", _me.UserId.Value));

        if (string.IsNullOrWhiteSpace(request.Phone))
        {
            user.ClearPhone();
        }
        else
        {
            var phone = PhoneNumber.Create(request.Phone);
            if (phone.IsFailure)
                return Result.Fail(phone.Error!);
            user.SetPhone(phone.Value!);
        }

        _users.Update(user);
        await _uow.CommitAsync(ct);
        return Result.Ok();
    }
}

// ── Rename (used by the first-login name prompt) ─────────────────────────────
public sealed record SetNameCommand(string Name) : IRequest<Result>;

public sealed class SetNameCommandValidator : AbstractValidator<SetNameCommand>
{
    public SetNameCommandValidator()
        => RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
}

public sealed class SetNameCommandHandler : IRequestHandler<SetNameCommand, Result>
{
    private readonly ICurrentUser    _me;
    private readonly IUserRepository _users;
    private readonly IUnitOfWork     _uow;

    public SetNameCommandHandler(ICurrentUser me, IUserRepository users, IUnitOfWork uow)
    {
        _me = me; _users = users; _uow = uow;
    }

    public async Task<Result> Handle(SetNameCommand request, CancellationToken ct)
    {
        if (!_me.IsAuthenticated || _me.UserId is null)
            return Result.Fail(Error.Unauthorized());

        var user = await _users.FindByIdAsync(_me.UserId.Value, ct);
        if (user is null)
            return Result.Fail(Error.NotFound("User", _me.UserId.Value));

        user.Rename(request.Name);
        _users.Update(user);
        await _uow.CommitAsync(ct);
        return Result.Ok();
    }
}
