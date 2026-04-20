using MediatR;
using FluentValidation;
using DigitalSocieties.Shared.Results;

namespace DigitalSocieties.Identity.Application.Behaviors;

/// <summary>
/// MediatR pipeline behavior: validates every command before it reaches its handler.
/// OCP — new validators auto-discovered; this behavior never changes.
/// </summary>
public sealed class ValidationBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators)
        => _validators = validators;

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken ct)
    {
        if (!_validators.Any()) return await next();

        var ctx     = new ValidationContext<TRequest>(request);
        var results = await Task.WhenAll(_validators.Select(v => v.ValidateAsync(ctx, ct)));
        var failures = results.SelectMany(r => r.Errors).Where(f => f is not null).ToList();

        if (failures.Count == 0) return await next();

        // Build a structured validation error compatible with Result<T>
        var errors = string.Join("; ", failures.Select(f => f.ErrorMessage));

        // If response is Result-shaped, return a Fail — otherwise throw
        if (typeof(TResponse).IsGenericType &&
            typeof(TResponse).GetGenericTypeDefinition() == typeof(Result<>))
        {
            var errorObj = new Error("VALIDATION", errors);
            var fail     = typeof(Result<>)
                .MakeGenericType(typeof(TResponse).GetGenericArguments()[0])
                .GetMethod("Fail", [typeof(Error)])!
                .Invoke(null, [errorObj]);
            return (TResponse)fail!;
        }

        throw new ValidationException(failures);
    }
}
