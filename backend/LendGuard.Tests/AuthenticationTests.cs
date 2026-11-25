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
}
