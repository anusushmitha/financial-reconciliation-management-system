using System;

namespace LendGuard.Domain.Entities;

public class InvestigationNote
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ExceptionId { get; set; }
    public Guid UserId { get; set; }
    public string Note { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DiscrepancyException? Exception { get; set; }
    public User? User { get; set; }
}
