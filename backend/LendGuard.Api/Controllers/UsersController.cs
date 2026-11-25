using System;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Common.Models;
using LendGuard.Application.DTOs;
using LendGuard.Application.Services;
using LendGuard.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LendGuard.Api.Controllers;

[ApiController]
[Route("api/v1/users")]
[Authorize(Roles = UserRole.Admin)]
public class UsersController : ApiControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet]
    public async Task<ActionResult<PaginatedList<UserSummaryDto>>> GetUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? role = null,
        [FromQuery] bool? status = null,
        CancellationToken cancellationToken = default)
    {
        var result = await _userService.GetUsersAsync(page, pageSize, search, role, status, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<UserDetailDto>> GetUserById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _userService.GetUserByIdAsync(id, cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<UserDetailDto>> CreateUser([FromBody] CreateUserRequest request, CancellationToken cancellationToken)
    {
        var result = await _userService.CreateUserAsync(request, CurrentUserId, cancellationToken);
        return CreatedAtAction(nameof(GetUserById), new { id = result.Id }, result);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<UserDetailDto>> UpdateUser(Guid id, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
    {
        var result = await _userService.UpdateUserAsync(id, request, CurrentUserId, cancellationToken);
        return Ok(result);
    }

    [HttpPatch("{id}/status")]
    public async Task<ActionResult<UserDetailDto>> UpdateUserStatus(Guid id, [FromBody] UpdateUserStatusRequest request, CancellationToken cancellationToken)
    {
        var result = await _userService.UpdateUserStatusAsync(id, request, CurrentUserId, cancellationToken);
        return Ok(result);
    }
}
