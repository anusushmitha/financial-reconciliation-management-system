using System;
using System.Linq;
using System.Text;
using System.Threading.RateLimiting;
using LendGuard.Api.Hubs;
using LendGuard.Api.Middlewares;
using LendGuard.Api.Services;
using LendGuard.Application;
using LendGuard.Application.Common.Interfaces;
using LendGuard.Infrastructure;
using LendGuard.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var defaultUrl = Environment.GetEnvironmentVariable("ASPNETCORE_URLS");
if (string.IsNullOrEmpty(defaultUrl))
{
    var urlArgIndex = Array.IndexOf(args, "--urls");
    defaultUrl = urlArgIndex >= 0 && urlArgIndex + 1 < args.Length ? args[urlArgIndex + 1] : "http://localhost:5000";
}
builder.WebHost.UseUrls(defaultUrl);

// 1. Add Infrastructure & Application layers
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApplication();

// 1.1 Add SignalR & Notification Services
builder.Services.AddSignalR();
builder.Services.AddScoped<INotificationService, SignalRNotificationService>();

// 2. Add Authentication & JWT
var jwtSecret = builder.Configuration["JWT_SECRET"] ?? "LendGuard_Super_Secret_Key_For_Jwt_Authentication_Must_Be_Long_2026";
var key = Encoding.UTF8.GetBytes(jwtSecret);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero
    };
});

// 3. Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

builder.Services.AddHttpClient();
builder.Services.AddControllers();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

var app = builder.Build();

// 4. Seed Database on startup
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<LendGuardDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    await DatabaseSeeder.SeedAsync(context, logger, app.Configuration);
}

// 5. Middleware Pipeline
if (app.Configuration.GetValue<bool>("REQUIRE_HTTPS") || app.Environment.IsProduction())
{
    app.UseHttpsRedirection();
}

// Enterprise Security Headers
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    await next();
});

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseCors("AllowAll");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<LendGuardHub>("/hubs/lendguard");

// Lightweight OpenAPI / Endpoint Discovery Catalog (Zero external NuGet dependency)
app.MapGet("/api/v1/openapi.json", (EndpointDataSource endpointSource) =>
{
    var routes = endpointSource.Endpoints
        .OfType<RouteEndpoint>()
        .Select(e => new
        {
            route = e.RoutePattern.RawText,
            methods = e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? new[] { "ANY" }
        })
        .OrderBy(r => r.route)
        .ToList();

    return Results.Ok(new
    {
        openapi = "3.0.1",
        info = new { title = "LendGuard Enterprise Reconciliation API", version = "v2.0" },
        endpointCount = routes.Count,
        endpoints = routes
    });
}).AllowAnonymous();

app.Run();
