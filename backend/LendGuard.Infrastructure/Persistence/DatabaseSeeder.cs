using System;
using System.Linq;
using System.Threading.Tasks;
using LendGuard.Domain;
using LendGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace LendGuard.Infrastructure.Persistence;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(LendGuardDbContext context, ILogger logger, IConfiguration? configuration = null)
    {
        var seedEnabled = configuration == null || !string.Equals(configuration["SEED_TEST_USERS"], "false", StringComparison.OrdinalIgnoreCase);
        if (!seedEnabled)
        {
            logger.LogInformation("SEED_TEST_USERS is set to false. Skipping default test user seeding for production/staging security.");
            return;
        }

        // 1. Seed Users if none exist
        if (!await context.Users.AnyAsync())
        {
            logger.LogInformation("Seeding initial users (admin@example.com and analyst@example.com)...");

            var adminUser = new User
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                FullName = "Admin User",
                Email = "admin@example.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
                Role = UserRole.Admin,
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            var analystUser = new User
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                FullName = "Analyst User",
                Email = "analyst@example.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Analyst123!"),
                Role = UserRole.Analyst,
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            context.Users.AddRange(adminUser, analystUser);
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded default Admin and Analyst accounts.");
        }
    }
}
