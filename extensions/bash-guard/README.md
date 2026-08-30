# bash-guard (tiện ích mở rộng pi)

Chặn các lệnh `bash` tool calls từ agent và áp dụng bảo vệ khác nhau tùy theo phiên có tương tác (phiên chính) hay không tương tác (subagent được spawn).

## Chế độ

Hành vi được xác định lúc registration time qua biến môi trường `PI_SUBAGENT_DEPTH`, được pi-subagents inject vào mọi spawned process.

### Phiên chính (`PI_SUBAGENT_DEPTH` = 0 hoặc chưa đặt) — interactive prompt

- Heuristically phát hiện các lệnh destructiveness/questionable qua shell-aware parsing
- Yêu cầu xác nhận cho **mọi** lệnh `git ...` (tăng severity cho những cái rủi ro đặc biệt: `git rm`, `git reset --hard`, `git clean -fdx`, `git push --force`, `git reflog expire`, `git gc --prune`)
- Yêu cầu xác nhận cho disk/volume tooling: `diskutil`, `hdiutil`, `mkfs*`, `newfs_*`, `wipefs`, `parted`, `fdisk`, `gdisk/sgdisk`, `cryptsetup`, `pvcreate/vgcreate/lvcreate`, `zpool`, `lsblk`
- Yêu cầu xác nhận cho: `rm`/`rmdir`/`unlink`, `sudo`, `find -delete`, `dd`, `truncate`, `sed -i`, `perl -pi`, `chmod/chown -R`, `mv/cp --force`, `kill`/`pkill`/`killall`, `shutdown`/`reboot`, `systemctl stop/disable`, `curl|sh`/`wget|sh`, `kubectl delete`, `terraform destroy`, `aws s3 rm --recursive`, `gcloud delete`, shell redirections (`>`, `>>`, `2>`), pipes
- Hiển thị 2-option dialog: **Chạy** / **Hủy**
- Nếu hủy, tool call bị chặn và model nhận được lý do rõ ràng
- Nhớ các lệnh đã hủy gần đây trong 60s để prevent retry loops

### Subagent (`PI_SUBAGENT_DEPTH` ≥ 1) — headless hard-block

Spawned subagents không có UI (stdin là `/dev/null`), nên prompting là không thể. Thay vào đó, một focused set của catastrophic/unrecoverable operations được hard-blocked không cần user interaction:

| Pattern | Lý do |
|---|---|
| `rm -r` / `-rf` / `-Rf` | Xóa recursive |
| `sudo` | Privileges elevated |
| `curl\|sh`, `wget\|sh` | Pipe to shell (remote code execution) |
| `mkfs*`, `newfs_*` | Filesystem formatting |
| `wipefs` | Disk signature wipe |
| `diskutil erase/zeroDisk/secureErase/reformat` | Destructive disk operation |
| `dd of=/dev/…` | Raw disk write |
| `parted`, `fdisk`, `gdisk`, `sgdisk` | Partition table management |
| `cryptsetup` | Disk encryption management |
| `zpool` | ZFS pool management |
| `shutdown`, `reboot`, `halt`, `poweroff` | System power operation |
| `terraform destroy` | Infrastructure teardown |
| `kubectl delete` | Kubernetes resource deletion |
| `aws s3 rm --recursive` | Bulk S3 deletion |
| `git commit` | Main-session operation |
| `git pull` | Main-session operation |
| `git push` | Main-session operation |
| `git reset --hard` | Discard all uncommitted changes |
| `git clean -f` | Xóa untracked files |
| `git reflog expire` | Xóa recovery history |
| `git gc --prune` | Prune unreachable objects |

Tất cả các lệnh khác (bao gồm routine git operations) pass through không ảnh hưởng.

## Cài đặt

Auto-discovered từ `~/.pi/agent/extensions/bash-guard/`. Chạy `/reload` trong pi.

## Lưu ý

- Scope: chỉ `bash` tool calls (`write`/`edit` và user `!` commands không bị chặn).
- `--bash-guard-auto-allow`: main-session flag cho phép flagged commands khi không có UI (vd chạy pi non-interactively). Không có effect trong subagent sessions.
