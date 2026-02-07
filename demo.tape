Output "/tmp/xc-demo.gif"
Output "/tmp/xc-demo.mp4"

Set Shell "bash"
Set FontSize 16
Set Width 900
Set Height 500
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 40ms

Type "# xc — X API CLI with built-in cost tracking"
Enter
Sleep 1s

Type "xc whoami --quiet"
Enter
Sleep 2s

Type "xc search 'AI agents' -n 3 --quiet"
Enter
Sleep 3s

Type "xc cost"
Enter
Sleep 3s

Type "xc budget show"
Enter
Sleep 3s

Sleep 1s
