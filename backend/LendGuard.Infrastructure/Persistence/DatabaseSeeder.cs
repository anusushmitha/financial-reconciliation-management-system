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
        logger.LogInformation("Ensuring standard enterprise users and active workloads are seeded...");

        var seedTestUsers = !string.Equals(configuration?["SEED_TEST_USERS"], "false", StringComparison.OrdinalIgnoreCase);

        var defaultAccounts = new[]
        {
            new { Id = Guid.Parse("5671a1c9-07e4-4239-81cc-20287f5bdb39"), Name = "Staging Enterprise Administrator", Email = "staging.admin@lendguard.internal", Password = "StagingAdmin_Secure2026!", Role = UserRole.Admin, IsDevSeed = false },
            new { Id = Guid.Parse("fc803e91-9e96-436b-8634-a817a4324f0f"), Name = "Staging Operational Analyst", Email = "staging.analyst@lendguard.internal", Password = "StagingAnalyst_Secure2026!", Role = UserRole.Analyst, IsDevSeed = false },
            new { Id = Guid.Parse("0bacefdb-b578-4289-8667-c6ff227df176"), Name = "Anu Sushmitha", Email = "sanushusmitha@gmail.com", Password = "Analyst123!", Role = UserRole.Analyst, IsDevSeed = false },
            new { Id = Guid.Parse("e7f2ded3-5736-421e-8440-e9e9000ffa8b"), Name = "Admin User", Email = "admin@example.com", Password = "Admin123!", Role = UserRole.Admin, IsDevSeed = true },
            new { Id = Guid.Parse("c1520d9b-c95b-495c-ace4-50b0ce9e22da"), Name = "Analyst User", Email = "analyst@example.com", Password = "Analyst123!", Role = UserRole.Analyst, IsDevSeed = true },
        };

        foreach (var acc in defaultAccounts)
        {
            var existing = await context.Users.FirstOrDefaultAsync(u => u.Email == acc.Email);
            if (acc.IsDevSeed && !seedTestUsers)
            {
                if (existing != null && existing.IsActive)
                {
                    existing.IsActive = false;
                    existing.UpdatedAt = DateTimeOffset.UtcNow;
                }
                continue;
            }

            if (existing == null)
            {
                var newUser = new User
                {
                    Id = acc.Id,
                    FullName = acc.Name,
                    Email = acc.Email,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(acc.Password),
                    Role = acc.Role,
                    IsActive = true,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                context.Users.Add(newUser);
            }
            else
            {
                existing.FullName = acc.Name;
                existing.IsActive = true;
                existing.PasswordHash = BCrypt.Net.BCrypt.HashPassword(acc.Password);
                existing.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        await context.SaveChangesAsync();
        logger.LogInformation("Core user accounts verified and synchronized.");

        // Ensure active assignment queue has starter items for presentation
        var anuUser = await context.Users.FirstOrDefaultAsync(u => u.Email == "sanushusmitha@gmail.com");
        var opUser = await context.Users.FirstOrDefaultAsync(u => u.Email == "staging.analyst@lendguard.internal");

        if (anuUser != null)
        {
            var anuCount = await context.Exceptions.CountAsync(e => e.AssignedTo == anuUser.Id && (e.Status == ExceptionStatus.Open || e.Status == ExceptionStatus.InProgress));
            if (anuCount < 2)
            {
                var unassigned = await context.Exceptions
                    .Where(e => e.AssignedTo == null && e.Status == ExceptionStatus.Open)
                    .Take(3)
                    .ToListAsync();

                foreach (var ex in unassigned)
                {
                    ex.AssignedTo = anuUser.Id;
                    ex.Status = ExceptionStatus.InProgress;
                    ex.UpdatedAt = DateTimeOffset.UtcNow;
                }
                await context.SaveChangesAsync();
                logger.LogInformation("Assigned starter demonstration exceptions to Anu Sushmitha.");
            }
        }

        if (opUser != null)
        {
            var opCount = await context.Exceptions.CountAsync(e => e.AssignedTo == opUser.Id && (e.Status == ExceptionStatus.Open || e.Status == ExceptionStatus.InProgress));
            if (opCount < 2)
            {
                var unassigned = await context.Exceptions
                    .Where(e => e.AssignedTo == null && e.Status == ExceptionStatus.Open)
                    .Take(3)
                    .ToListAsync();

                foreach (var ex in unassigned)
                {
                    ex.AssignedTo = opUser.Id;
                    ex.Status = ExceptionStatus.InProgress;
                    ex.UpdatedAt = DateTimeOffset.UtcNow;
                }
                await context.SaveChangesAsync();
                logger.LogInformation("Assigned starter demonstration exceptions to Staging Operational Analyst.");
            }
        }
    }
}
