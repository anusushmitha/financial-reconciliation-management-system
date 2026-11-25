using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.DTOs;
using LendGuard.Domain.Entities;

namespace LendGuard.Application.Common.Interfaces;

public interface IAiClientService
{
    Task<AiAnalysisDto> AnalyzeAnomalyAsync(DiscrepancyException exception, Transaction? evidenceTxn, CancellationToken cancellationToken = default);
    Task<AiAnalysisDto> ExplainExceptionAsync(DiscrepancyException exception, Transaction? internalTxn, Transaction? externalTxn, CancellationToken cancellationToken = default);
    Task<bool> CalibrateModelAsync(IEnumerable<Transaction> transactions, CancellationToken cancellationToken = default);
}
