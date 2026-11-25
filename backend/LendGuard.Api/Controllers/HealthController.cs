using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LendGuard.Api.Controllers;

[ApiController]
[AllowAnonymous]
public class HealthController : ControllerBase
{
    [HttpGet("health")]
    [HttpGet("api/v1/health")]
    public IActionResult GetHealth()
    {
        return Ok(new { status = "Healthy" });
    }
}
