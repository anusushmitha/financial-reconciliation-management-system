using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Common.Interfaces;
using LendGuard.Application.Common.Models;
using LendGuard.Application.DTOs;
using LendGuard.Domain;
using LendGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LendGuard.Application.Services;

public interface IUserService
{
    Task<PaginatedList<UserSummaryDto>> GetUsersAsync(int page = 1, int pageSize = 20, string? search = null, string? role = null, bool? isActive = null, CancellationToken cancellationToken = default);
    Task<UserDetailDto> GetUserByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<UserDetailDto> CreateUserAsync(CreateUserRequest request, Guid currentUserId, CancellationToken cancellationToken = default);
    Task<UserDetailDto> UpdateUserAsync(Guid id, UpdateUserRequest request, Guid currentUserId, CancellationToken cancellationToken = default);
    Task<UserDetailDto> UpdateUserStatusAsync(Guid id, UpdateUserStatusRequest request, Guid currentUserId, CancellationToken cancellationToken = default);
}

public class UserService : IUserService
{
    private readonly IApplicationDbContext _context;
    private readonly IAuditService _auditService;

    public UserService(IApplicationDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    public async Task<PaginatedList<UserSummaryDto>> GetUsersAsync(int page = 1, int pageSize = 20, string? search = null, string? role = null, bool? isActive = null, CancellationToken cancellationToken = default)
    {
        var query = _context.Users.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(u => u.FullName.ToLower().Contains(s) || u.Email.ToLower().Contains(s));
        }

        if (!string.IsNullOrWhiteSpace(role))
        {
            query = query.Where(u => u.Role == role.Trim().ToUpper());
        }

        if (isActive.HasValue)
        {
            query = query.Where(u => u.IsActive == isActive.Value);
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query.OrderByDescending(u => u.CreatedAt)
                               .Skip((page - 1) * pageSize)
                               .Take(pageSize)
                               .Select(u => new UserSummaryDto
                               {
                                   Id = u.Id,
                                   FullName = u.FullName,
                                   Email = u.Email,
                                   Role = u.Role,
                                   IsActive = u.IsActive,
                                   CreatedAt = u.CreatedAt
                               })
                               .ToListAsync(cancellationToken);

        return new PaginatedList<UserSummaryDto>(items, total, page, pageSize);
    }

    public async Task<UserDetailDto> GetUserByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user == null)
        {
            throw new KeyNotFoundException("User not found.");
        }

        return new UserDetailDto
        {
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email,
            Role = user.Role,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt
        };
    }

    public async Task<UserDetailDto> CreateUserAsync(CreateUserRequest request, Guid currentUserId, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var exists = await _context.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);
        if (exists)
        {
            throw new InvalidOperationException("A user with this email address already exists.");
        }

        var role = request.Role.Trim().ToUpper();
        if (role != UserRole.Admin && role != UserRole.Analyst)
        {
            throw new ArgumentException("Invalid role specified. Must be ADMIN or ANALYST.");
        }

        var newUser = new User
        {
            Id = Guid.NewGuid(),
            FullName = request.FullName.Trim(),
            Email = normalizedEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.TemporaryPassword),
            Role = role,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("USER_CREATED", "USER", newUser.Id, currentUserId, new { email = newUser.Email, role = newUser.Role }, null, cancellationToken);

        return new UserDetailDto
        {
            Id = newUser.Id,
            FullName = newUser.FullName,
            Email = newUser.Email,
            Role = newUser.Role,
            IsActive = newUser.IsActive,
            CreatedAt = newUser.CreatedAt,
            UpdatedAt = newUser.UpdatedAt
        };
    }

    public async Task<UserDetailDto> UpdateUserAsync(Guid id, UpdateUserRequest request, Guid currentUserId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user == null)
        {
            throw new KeyNotFoundException("User not found.");
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (user.Email.ToLower() != normalizedEmail)
        {
            var conflict = await _context.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail && u.Id != id, cancellationToken);
            if (conflict)
            {
                throw new InvalidOperationException("Another user already exists with this email address.");
            }
            user.Email = normalizedEmail;
        }

        user.FullName = request.FullName.Trim();
        var role = request.Role.Trim().ToUpper();
        if (role == UserRole.Admin || role == UserRole.Analyst)
        {
            user.Role = role;
        }
        user.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        await _auditService.LogAsync("USER_UPDATED", "USER", user.Id, currentUserId, new { fullName = user.FullName, email = user.Email, role = user.Role }, null, cancellationToken);

        return new UserDetailDto
        {
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email,
            Role = user.Role,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt
        };
    }

    public async Task<UserDetailDto> UpdateUserStatusAsync(Guid id, UpdateUserStatusRequest request, Guid currentUserId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user == null)
        {
            throw new KeyNotFoundException("User not found.");
        }

        // Prevent deactivating final active admin
        if (!request.IsActive && user.Role == UserRole.Admin)
        {
            var activeAdminCount = await _context.Users.CountAsync(u => u.Role == UserRole.Admin && u.IsActive && u.Id != id, cancellationToken);
            if (activeAdminCount == 0)
            {
                throw new InvalidOperationException("Cannot deactivate the final active administrator account.");
            }
        }

        user.IsActive = request.IsActive;
        user.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        await _auditService.LogAsync(user.IsActive ? "USER_ACTIVATED" : "USER_DEACTIVATED", "USER", user.Id, currentUserId, new { isActive = user.IsActive }, null, cancellationToken);

        return new UserDetailDto
        {
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email,
            Role = user.Role,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt
        };
    }
}
