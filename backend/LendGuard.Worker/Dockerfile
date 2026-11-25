FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY backend/LendGuard.Domain/LendGuard.Domain.csproj backend/LendGuard.Domain/
COPY backend/LendGuard.Application/LendGuard.Application.csproj backend/LendGuard.Application/
COPY backend/LendGuard.Infrastructure/LendGuard.Infrastructure.csproj backend/LendGuard.Infrastructure/
COPY backend/LendGuard.Worker/LendGuard.Worker.csproj backend/LendGuard.Worker/

RUN dotnet restore backend/LendGuard.Worker/LendGuard.Worker.csproj

COPY backend/ backend/

WORKDIR /src/backend/LendGuard.Worker
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/runtime:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "LendGuard.Worker.dll"]
