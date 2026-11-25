using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace LendGuard.Api.Hubs;

public class LendGuardHub : Hub
{
    public async Task JoinRoom(string roomName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, roomName);
    }

    public async Task LeaveRoom(string roomName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomName);
    }
}
