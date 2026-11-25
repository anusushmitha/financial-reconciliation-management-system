FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY backend/LendGuard.Domain/LendGuard.Domain.csproj backend/LendGuard.Domain/
COPY backend/LendGuard.Application/LendGuard.Application.csproj backend/LendGuard.Application/
COPY backend/LendGuard.Infrastructure/LendGuard.Infrastructure.csproj backend/LendGuard.Infrastructure/
COPY backend/LendGuard.Api/LendGuard.Api.csproj backend/LendGuard.Api/

RUN dotnet restore backend/LendGuard.Api/LendGuard.Api.csproj

COPY backend/ backend/

WORKDIR /src/backend/LendGuard.Api
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000

ENTRYPOINT ["dotnet", "LendGuard.Api.dll"]
