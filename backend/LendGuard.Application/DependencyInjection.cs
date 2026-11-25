using LendGuard.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace LendGuard.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IImportService, ImportService>();
        services.AddScoped<ITransactionService, TransactionService>();
        services.AddScoped<IReconciliationService, ReconciliationService>();
        services.AddScoped<IExceptionService, ExceptionService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IReportService, ReportService>();
        services.AddScoped<IAuditLogService, AuditLogService>();

        return services;
    }
}
