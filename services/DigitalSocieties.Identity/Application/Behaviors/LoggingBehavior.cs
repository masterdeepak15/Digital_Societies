using MediatR;
using Microsoft.Extensions.Logging;
using System.Diagnostics;

namespace DigitalSocieties.Identity.Application.Behaviors;

/// <summary>
/// Logs command name, execution time, and outcome. (SRP — logging only)
/// </summary>
public sealed class LoggingBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
{
    private readonly ILogger<LoggingBehavior<TRequest, TResponse>> _logger;

    public LoggingBehavior(ILogger<LoggingBehavior<TRequest, TResponse>> logger)
        => _logger = logger;

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken ct)
    {
        var name = typeof(TRequest).Name;
        var sw   = Stopwatch.StartNew();

        _logger.LogInformation("[{Command}] Handling started", name);
        try
        {
            var result = await next();
            _logger.LogInformation("[{Command}] Completed in {Ms}ms", name, sw.ElapsedMilliseconds);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{Command}] Failed in {Ms}ms", name, sw.ElapsedMilliseconds);
            throw;
        }
    }
}
