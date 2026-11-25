using LendGuard.Application;
using LendGuard.Infrastructure;
using LendGuard.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApplication();
builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
