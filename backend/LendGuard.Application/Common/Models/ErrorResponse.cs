using System;
using System.Collections.Generic;

namespace LendGuard.Application.Common.Models;

public class FieldError
{
    public string Field { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public class ErrorDetails
{
    public string Code { get; set; } = "INTERNAL_ERROR";
    public string Message { get; set; } = "An unexpected error occurred.";
    public List<FieldError>? FieldErrors { get; set; }
    public Guid CorrelationId { get; set; } = Guid.NewGuid();
}

public class StandardErrorResponse
{
    public bool Success { get; set; } = false;
    public ErrorDetails Error { get; set; } = new();
}
