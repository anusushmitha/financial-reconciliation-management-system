using Microsoft.AspNetCore.Mvc;

namespace LendGuard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReconcileController : ControllerBase
    {
        private readonly ReconciliationService _service;

        public ReconcileController(ReconciliationService service)
        {
            _service = service;
        }

        public class ReconcileRequestDto
        {
            public string? ExecutedBy { get; set; } = "System Administrator";
        }

        [HttpPost("run")]
        public IActionResult RunReconciliation([FromBody] ReconcileRequestDto? request)
        {
            var executedBy = request?.ExecutedBy ?? "System Administrator";
            var result = _service.Reconcile(executedBy);
            return Ok(result);
        }
    }
}
