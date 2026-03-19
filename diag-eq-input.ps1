Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class EQInput {
    [DllImport("user32.dll")] static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")] static extern uint MapVirtualKeyA(uint uCode, uint uMapType);
    [DllImport("user32.dll")] static extern short VkKeyScan(char ch);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern int GetWindowTextA(IntPtr hWnd, StringBuilder text, int count);

    public static string GetForegroundTitle() {
        IntPtr fg = GetForegroundWindow();
        var sb = new StringBuilder(256);
        GetWindowTextA(fg, sb, 256);
        return sb.ToString();
    }

    // Method 1: plain keybd_event with virtual key only
    public static void VkPress(byte vk) {
        keybd_event(vk, 0, 0, UIntPtr.Zero);
        Thread.Sleep(30);
        keybd_event(vk, 0, 2, UIntPtr.Zero);
        Thread.Sleep(30);
    }

    // Method 2: keybd_event with VK + scan code (no SCANCODE flag)
    public static void VkScanPress(byte vk) {
        byte sc = (byte)MapVirtualKeyA(vk, 0);
        keybd_event(vk, sc, 0, UIntPtr.Zero);
        Thread.Sleep(30);
        keybd_event(vk, sc, 2, UIntPtr.Zero);
        Thread.Sleep(30);
    }

    // Method 3: keybd_event with SCANCODE flag
    public static void ScanPress(byte vk) {
        byte sc = (byte)MapVirtualKeyA(vk, 0);
        keybd_event(0, sc, 8, UIntPtr.Zero);
        Thread.Sleep(30);
        keybd_event(0, sc, 10, UIntPtr.Zero);
        Thread.Sleep(30);
    }

    public static void TypeCharVk(char c) {
        short v = VkKeyScan(c);
        if (v == -1) return;
        byte lo = (byte)(v & 0xFF);
        bool shift = ((v >> 8) & 1) != 0;
        byte sc = (byte)MapVirtualKeyA(lo, 0);
        if (shift) keybd_event(0x10, 0x2A, 0, UIntPtr.Zero);
        keybd_event(lo, sc, 0, UIntPtr.Zero);
        Thread.Sleep(15);
        keybd_event(lo, sc, 2, UIntPtr.Zero);
        if (shift) keybd_event(0x10, 0x2A, 2, UIntPtr.Zero);
        Thread.Sleep(15);
    }

    public static void TypeStringVk(string s) {
        foreach (char c in s) TypeCharVk(c);
    }
}
'@

$fg = [EQInput]::GetForegroundTitle()
Write-Output "Foreground window: '$fg'"

if ($fg -ne "EverQuest") {
    Write-Output ""
    Write-Output "*** ERROR: EverQuest is NOT the foreground window! ***"
    Write-Output "*** The test cannot work. Make sure you click on EQ! ***"
    exit 1
}

Write-Output "EQ confirmed as foreground - sending keystrokes..."
Write-Output ""

Write-Output "Pressing Enter (VK method - open chat)..."
[EQInput]::VkPress(0x0D)
Start-Sleep -Milliseconds 300

Write-Output "Typing '/say test' (VK method)..."
[EQInput]::TypeStringVk("/say test")
Start-Sleep -Milliseconds 200

Write-Output "Pressing Enter (VK method - send)..."
[EQInput]::VkPress(0x0D)
Start-Sleep -Milliseconds 500

Write-Output ""
Write-Output "If nothing appeared, check if EQ still has focus and try again."
