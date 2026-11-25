using LendGuard.Application.Common.Interfaces;
using LendGuard.Infrastructure.Persistence;
using LendGuard.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LendGuard.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection") 
                               ?? configuration["DATABASE_URL"] 
                               ?? "Host=localhost;Port=5433;Database=lendguard;Username=app;Password=lendguard_password";

        services.AddDbContext<LendGuardDbContext>(options =>
            options.UseNpgsql(connectionString, b => b.MigrationsAssembly(typeof(LendGuardDbContext).Assembly.FullName))
                   .UseSnakeCaseNamingConvention());

        services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<LendGuardDbContext>());
        services.AddScoped<IAuditService, AuditService>();
        services.AddSingleton<IFileStorageService, FileStorageService>();
        services.AddSingleton<IJwtService, JwtService>();
        services.AddHttpClient<IAiClientService, AiClientService>();

        return services;
    }
}
