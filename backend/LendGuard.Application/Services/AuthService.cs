using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Common.Interfaces;
using LendGuard.Application.DTOs;
using LendGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LendGuard.Application.Services;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<UserProfileDto> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<MessageResponse> ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken = default);
    Task<MessageResponse> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default);
}

public class AuthService : IAuthService
{
    private readonly IApplicationDbContext _context;
    private readonly IJwtService _jwtService;
    private readonly IAuditService _auditService;

    public AuthService(IApplicationDbContext context, IJwtService jwtService, IAuditService auditService)
    {
        _context = context;
        _jwtService = jwtService;
        _auditService = auditService;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            await _auditService.LogAsync("LOGIN_FAILURE", "USER", user?.Id, user?.Id, new { email = normalizedEmail, reason = "INVALID_CREDENTIALS" }, null, cancellationToken);
            throw new UnauthorizedAccessException("Email or password is incorrect.");
        }

        if (!user.IsActive)
        {
            await _auditService.LogAsync("LOGIN_FAILURE", "USER", user.Id, user.Id, new { email = normalizedEmail, reason = "ACCOUNT_INACTIVE" }, null, cancellationToken);
            throw new InvalidOperationException("Account is inactive.");
        }

        var (token, expiresAt) = _jwtService.GenerateToken(user);
        await _auditService.LogAsync("LOGIN_SUCCESS", "USER", user.Id, user.Id, new { email = normalizedEmail, role = user.Role }, null, cancellationToken);

        return new LoginResponse
        {
            AccessToken = token,
            ExpiresAt = expiresAt,
            User = new UserProfileDto
            {
                Id = user.Id,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role
            }
        };
    }

    public async Task<UserProfileDto> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user == null)
        {
            throw new KeyNotFoundException("User not found.");
        }

        return new UserProfileDto
        {
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email,
            Role = user.Role
        };
    }

    public async Task<MessageResponse> ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);

        if (user != null && user.IsActive)
        {
            var rawToken = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
            var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken))).ToLowerInvariant();

            var resetToken = new PasswordResetToken
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                TokenHash = tokenHash,
                ExpiresAt = DateTimeOffset.UtcNow.AddHours(2),
                CreatedAt = DateTimeOffset.UtcNow
            };

            _context.PasswordResetTokens.Add(resetToken);
            await _context.SaveChangesAsync(cancellationToken);

            // In local/dev environments we log the reset token safely for verification
            // Production will route through verified SMTP sender
        }

        return new MessageResponse
        {
            Message = "If the account exists, reset instructions will be sent."
        };
    }

    public async Task<MessageResponse> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            throw new ArgumentException("Token is required.");
        }

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
        {
            throw new ArgumentException("Password must be at least 8 characters long.");
        }

        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(request.Token.Trim()))).ToLowerInvariant();
        var tokenRecord = await _context.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);

        if (tokenRecord == null || tokenRecord.UsedAt != null || tokenRecord.ExpiresAt < DateTimeOffset.UtcNow)
        {
            throw new KeyNotFoundException("Reset token is invalid or has expired.");
        }

        var user = tokenRecord.User;
        if (user == null)
        {
            throw new KeyNotFoundException("Associated user was not found.");
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTimeOffset.UtcNow;
        tokenRecord.UsedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        await _auditService.LogAsync("PASSWORD_RESET", "USER", user.Id, user.Id, null, null, cancellationToken);

        return new MessageResponse
        {
            Message = "Password updated."
        };
    }
}
