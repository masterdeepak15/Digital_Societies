namespace DigitalSocieties.Shared.Results;

/// <summary>
/// Discriminated union representing success or failure.
/// Eliminates exception-driven flow for expected business failures. (SRP / OCP)
/// </summary>
public sealed class Result<T>
{
    private Result(T? value, Error? error)
    {
        Value = value;
        Error = error;
    }

    public bool IsSuccess  => Error is null;
    public bool IsFailure  => !IsSuccess;
    public T?   Value      { get; }
    public Error? Error    { get; }

    public static Result<T> Ok(T value)          => new(value, null);
    public static Result<T> Fail(Error error)    => new(default, error);
    public static Result<T> Fail(string code, string message)
        => new(default, new Error(code, message));

    public TOut Match<TOut>(Func<T, TOut> onSuccess, Func<Error, TOut> onFailure)
        => IsSuccess ? onSuccess(Value!) : onFailure(Error!);
}

public sealed class Result
{
    private Result(Error? error) => Error = error;
    public bool   IsSuccess  => Error is null;
    public bool   IsFailure  => !IsSuccess;
    public Error? Error      { get; }

    public static Result Ok()                    => new(null);
    public static Result Fail(Error error)       => new(error);
    public static Result Fail(string code, string message)
        => new(new Error(code, message));
}

public sealed record Error(string Code, string Message)
{
    public static readonly Error None = new(string.Empty, string.Empty);

    // Common domain errors (open for extension via static factories)
    public static Error NotFound(string entity, object id)
        => new($"{entity}.NOT_FOUND", $"{entity} '{id}' was not found.");

    public static Error Unauthorized(string reason = "Unauthorized")
        => new("UNAUTHORIZED", reason);

    public static Error Conflict(string message)
        => new("CONFLICT", message);

    public static Error Validation(string message)
        => new("VALIDATION", message);
}
