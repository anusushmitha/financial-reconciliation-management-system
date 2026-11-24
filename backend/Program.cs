using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

// Database configuration
builder.Services.AddDbContext<LendGuardContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Services
builder.Services.AddScoped<ReconciliationService>();
builder.Services.AddHttpClient();

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "LendGuardSuperSecretKey2026SecureJwtAuthentication!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "LendGuard";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "LendGuardClients";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "LENDGUARD AI Web API",
        Version = "v1",
        Description = "Intelligent Financial Transaction Reconciliation & Exception Management API"
    });
});

var app = builder.Build();

// Auto-migrate and seed default users
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<LendGuardContext>();
    db.Database.EnsureCreated();

    // Seed default administrator if not present
    if (!db.Users.Any(u => u.Username == "admin"))
    {
        db.Users.Add(new User
        {
            Username = "admin",
            FullName = "Lead Administrator",
            Email = "admin@lendguard.ai",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
            Role = "Administrator",
            Department = "Financial Oversight",
            IsActive = true,
            CreatedDate = DateTime.UtcNow
        });
    }

    // Seed default operations analyst
    if (!db.Users.Any(u => u.Username == "analyst"))
    {
        db.Users.Add(new User
        {
            Username = "analyst",
            FullName = "Senior Operations Analyst",
            Email = "analyst@lendguard.ai",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Analyst@123"),
            Role = "Operations Analyst",
            Department = "Transaction Reconciliation",
            IsActive = true,
            CreatedDate = DateTime.UtcNow
        });
    }

    db.SaveChanges();
}

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "LendGuard API v1");
    c.RoutePrefix = "swagger";
});

app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
