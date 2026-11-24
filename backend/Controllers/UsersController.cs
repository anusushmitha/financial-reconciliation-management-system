using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace LendGuard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly LendGuardContext _context;

        public UsersController(LendGuardContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetUsers([FromQuery] string? role, [FromQuery] bool? isActive)
        {
            var query = _context.Users.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(role) && role != "All")
            {
                query = query.Where(u => u.Role == role);
            }

            if (isActive.HasValue)
            {
                query = query.Where(u => u.IsActive == isActive.Value);
            }

            var users = await query.OrderBy(u => u.Username).ToListAsync();

            // Calculate workload metrics per employee
            var result = users.Select(u => new
            {
                u.Id,
                u.Username,
                u.FullName,
                u.Email,
                u.Role,
                u.Department,
                u.IsActive,
                u.CreatedDate,
                AssignedExceptionCount = _context.Exceptions.Count(e => (e.AssignedEmployeeId == u.Id.ToString() || e.AssignedEmployeeName == u.Username) && (e.Status == "Assigned" || e.Status == "In Progress")),
                ResolvedExceptionCount = _context.Exceptions.Count(e => (e.AssignedEmployeeId == u.Id.ToString() || e.AssignedEmployeeName == u.Username) && (e.Status == "Resolved" || e.Status == "Closed")),
                TotalWorkload = _context.Exceptions.Count(e => e.AssignedEmployeeId == u.Id.ToString() || e.AssignedEmployeeName == u.Username)
            });

            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = $"User #{id} not found." });

            var assignedExceptions = await _context.Exceptions
                .Where(e => e.AssignedEmployeeId == id.ToString() || e.AssignedEmployeeName == user.Username)
                .OrderByDescending(e => e.CreatedDate)
                .Take(20)
                .ToListAsync();

            return Ok(new
            {
                user.Id,
                user.Username,
                user.FullName,
                user.Email,
                user.Role,
                user.Department,
                user.IsActive,
                user.CreatedDate,
                assignedExceptions
            });
        }

        public class CreateUserDto
        {
            public string Username { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
            public string FullName { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public string Role { get; set; } = "Operations Analyst";
            public string Department { get; set; } = "Financial Operations";
        }

        [HttpPost]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
        {
            if (await _context.Users.AnyAsync(u => u.Username.ToLower() == dto.Username.ToLower()))
            {
                return Conflict(new { message = $"Username '{dto.Username}' already exists." });
            }

            var user = new User
            {
                Username = dto.Username,
                FullName = string.IsNullOrWhiteSpace(dto.FullName) ? dto.Username : dto.FullName,
                Email = dto.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Role = dto.Role,
                Department = dto.Department,
                IsActive = true,
                CreatedDate = DateTime.UtcNow
            };

            await _context.Users.AddAsync(user);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetUser), new { id = user.Id }, new
            {
                user.Id,
                user.Username,
                user.FullName,
                user.Email,
                user.Role,
                user.Department,
                user.IsActive
            });
        }

        [HttpPatch("{id}/toggle-status")]
        public async Task<IActionResult> ToggleUserStatus(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            user.IsActive = !user.IsActive;
            await _context.SaveChangesAsync();

            return Ok(new { user.Id, user.Username, user.IsActive });
        }
    }
}
