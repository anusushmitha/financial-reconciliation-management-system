using System.Text;
using LendGuard.Api.Middlewares;
using LendGuard.Application;
using LendGuard.Infrastructure;
using LendGuard.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
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

builder.Services.AddControllers();

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
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
