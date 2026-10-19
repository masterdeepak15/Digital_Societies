using System.Threading.Channels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using DigitalSocieties.Communication.Application.Notices;

namespace DigitalSocieties.Communication.Infrastructure.Notices;

/// <summary>
/// Sends notices by email in the background, so posting a notice is instant even for a society of hundreds.
/// Queued notices are held in memory; a restart in the middle can lose the ones not yet sent (the notice itself is saved).
/// </summary>
public sealed class NoticeEmailWorker : BackgroundService, INoticeEmailQueue
{
    private readonly Channel<NoticeEmail> _queue = Channel.CreateBounded<NoticeEmail>(new BoundedChannelOptions(100) { FullMode = BoundedChannelFullMode.DropOldest });
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<NoticeEmailWorker> _log;

    public NoticeEmailWorker(IServiceScopeFactory scopes, ILogger<NoticeEmailWorker> log) => (_scopes, _log) = (scopes, log);

    public void Enqueue(NoticeEmail notice) => _queue.Writer.TryWrite(notice);

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        await foreach (var notice in _queue.Reader.ReadAllAsync(stop))
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var sent = await scope.ServiceProvider.GetRequiredService<NoticeEmailer>().SendAsync(notice, stop);
                _log.LogInformation("[NoticeEmail] '{Title}' emailed to {Count} member(s)", notice.Title, sent);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                _log.LogError(e, "[NoticeEmail] sending '{Title}' failed", notice.Title);
            }
        }
    }
}
