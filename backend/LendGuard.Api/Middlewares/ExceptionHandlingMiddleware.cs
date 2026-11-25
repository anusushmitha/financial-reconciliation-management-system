using System;
using System.Collections.Generic;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using LendGuard.Application.Common.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace LendGuard.Api.Middlewares;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception occurred during request execution: {Path}", context.Request.Path);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var correlationId = Guid.NewGuid();
        context.Response.ContentType = "application/json";

        var (statusCode, code, message) = exception switch
        {
            UnauthorizedAccessException uae => (HttpStatusCode.Unauthorized, "INVALID_CREDENTIALS", uae.Message),
            KeyNotFoundException knf => (HttpStatusCode.NotFound, "NOT_FOUND", knf.Message),
            ArgumentException ae => (HttpStatusCode.BadRequest, "VALIDATION_ERROR", ae.Message),
            InvalidOperationException ioe when ioe.Message.Contains("active") || ioe.Message.Contains("already") => (HttpStatusCode.Conflict, "CONFLICT", ioe.Message),
            InvalidOperationException ioe => (HttpStatusCode.BadRequest, "INVALID_OPERATION", ioe.Message),
            _ => (HttpStatusCode.InternalServerError, "INTERNAL_ERROR", "An unexpected error occurred. Please refer to correlation ID.")
        };

        context.Response.StatusCode = (int)statusCode;

        var errorResponse = new StandardErrorResponse
        {
            Success = false,
            Error = new ErrorDetails
            {
                Code = code,
                Message = message,
                CorrelationId = correlationId
            }
        };

        var json = JsonSerializer.Serialize(errorResponse);
        await context.Response.WriteAsync(json);
    }
}
