using System;
using System.Threading.Tasks;
using LendGuard.Application.Common.Interfaces;
using LendGuard.Application.DTOs;
using LendGuard.Application.Services;
using LendGuard.Domain;
using LendGuard.Domain.Entities;
using LendGuard.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace LendGuard.Tests;

public class AuthenticationTests
{
    private (LendGuardDbContext context, AuthService service) CreateTestSetup()
    {
        var options = new DbContextOptionsBuilder<LendGuardDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = new LendGuardDbContext(options);
        var jwtMock = new Mock<IJwtService>();
        jwtMock.Setup(j => j.GenerateToken(It.IsAny<User>()))
               .Returns(("mock.jwt.token", DateTimeOffset.UtcNow.AddHours(2)));

        var auditMock = new Mock<IAuditService>();
        var service = new AuthService(context, jwtMock.Object, auditMock.Object);

        return (context, service);
    }

    [Fact]
    public async Task AUTH01_ValidLogin_ReturnsAccessTokenAndUserProfile()
    {
        // Arrange
        var (context, service) = CreateTestSetup();
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Analyst Test",
            Email = "analyst@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("ValidPassword123!"),
            Role = UserRole.Analyst,
            IsActive = true
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        // Act
        var result = await service.LoginAsync(new LoginRequest
        {
            Email = "analyst@example.com",
            Password = "ValidPassword123!"
        });

        // Assert
        Assert.NotNull(result);
        Assert.Equal("mock.jwt.token", result.AccessToken);
        Assert.Equal("analyst@example.com", result.User.Email);
        Assert.Equal(UserRole.Analyst, result.User.Role);
    }

    [Fact]
    public async Task AUTH02_InvalidPassword_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        var (context, service) = CreateTestSetup();
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Analyst Test",
            Email = "analyst@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("CorrectPassword123!"),
            Role = UserRole.Analyst,
            IsActive = true
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        // Act & Assert
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.LoginAsync(new LoginRequest
        {
            Email = "analyst@example.com",
            Password = "WrongPassword!"
        }));
    }

    [Fact]
    public async Task AUTH03_InactiveUser_ThrowsInvalidOperationException()
    {
        // Arrange
        var (context, service) = CreateTestSetup();
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Inactive Test",
            Email = "inactive@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
            Role = UserRole.Analyst,
            IsActive = false
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        // Act & Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.LoginAsync(new LoginRequest
        {
            Email = "inactive@example.com",
            Password = "Password123!"
        }));

        Assert.Contains("inactive", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SEC01_AdminSelfDeactivation_ThrowsInvalidOperationException()
    {
        // Arrange
        var (context, _) = CreateTestSetup();
        var auditMock = new Mock<IAuditService>();
        var userService = new UserService(context, auditMock.Object);

        var admin1 = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Admin One",
            Email = "admin1@lendguard.internal",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Pass123!"),
            Role = UserRole.Admin,
            IsActive = true
        };
        var admin2 = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Admin Two",
            Email = "admin2@lendguard.internal",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Pass123!"),
            Role = UserRole.Admin,
            IsActive = true
        };
        context.Users.AddRange(admin1, admin2);
        await context.SaveChangesAsync();

        // Act & Assert: even when another admin exists, admin1 cannot deactivate themselves
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            userService.UpdateUserStatusAsync(admin1.Id, new UpdateUserStatusRequest { IsActive = false }, admin1.Id));

        Assert.Contains("own active account", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SEC02_DeactivateFinalActiveAdmin_ThrowsInvalidOperationException()
    {
        // Arrange
        var (context, _) = CreateTestSetup();
        var auditMock = new Mock<IAuditService>();
        var userService = new UserService(context, auditMock.Object);

        var onlyAdmin = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Final Admin",
            Email = "finaladmin@lendguard.internal",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Pass123!"),
            Role = UserRole.Admin,
            IsActive = true
        };
        context.Users.Add(onlyAdmin);
        await context.SaveChangesAsync();

        // Act & Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            userService.UpdateUserStatusAsync(onlyAdmin.Id, new UpdateUserStatusRequest { IsActive = false }, Guid.NewGuid()));

        Assert.Contains("final active administrator", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SEC03_ChangePassword_ValidatesCurrentAndUpdatesHash()
    {
        // Arrange
        var (context, authService) = CreateTestSetup();
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Password Changer",
            Email = "changer@lendguard.internal",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("OldPassword123!"),
            Role = UserRole.Analyst,
            IsActive = true
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        // Wrong current password rejected
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            authService.ChangePasswordAsync(user.Id, new ChangePasswordRequest { CurrentPassword = "Wrong", NewPassword = "NewPassword456!" }));

        // Act: valid change
        var res = await authService.ChangePasswordAsync(user.Id, new ChangePasswordRequest
        {
            CurrentPassword = "OldPassword123!",
            NewPassword = "NewPassword456!"
        });

        // Assert
        Assert.Contains("successfully", res.Message, StringComparison.OrdinalIgnoreCase);
        var updated = await context.Users.FindAsync(user.Id);
        Assert.True(BCrypt.Net.BCrypt.Verify("NewPassword456!", updated!.PasswordHash));
    }
}
