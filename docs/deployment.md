# 배포 가이드 — Oracle Cloud Always Free

무료로 계속 운영하는 것을 목표로 한 구성입니다.

```
        인터넷
          │ 443 (HTTPS)
     ┌────▼─────┐
     │Cloudflare│  무료 HTTPS · 캐시 · IP 은닉
     └────┬─────┘
          │ 80
┌─────────▼──────────┐        ┌──────────────────┐
│ 인스턴스 B (1GB)    │ 3306   │ 인스턴스 A (1GB) │
│  nginx + 프론트     ├───────▶│  MySQL           │
│  Spring Boot        │ 사설IP  │                  │
└────────────────────┘        └──────────────────┘
```

**왜 2대인가**: 1GB 한 대에 MySQL + JVM + nginx 를 넣으면 메모리가 빠듯합니다.
Always Free 는 어차피 1GB 인스턴스를 **2대** 주므로 나누는 편이 안정적입니다.

**왜 서버에서 빌드하지 않는가**: 1/8 OCPU · 1GB 에서는 Gradle · Vite 빌드가
메모리 부족으로 실패합니다. GitHub Actions 가 이미지를 만들고 서버는 받아서 실행만 합니다.

---

## 내 환경 (2026-08-20 기준)

아래 절차의 예시 IP 대신 이 값을 쓰면 됩니다.

| 역할 | 인스턴스 | 사설 IP | OS |
|---|---|---|---|
| **A — MySQL** | `instance-20260820-1726` | **`10.0.0.149`** | Ubuntu 24.04 |
| **B — 앱/웹** | `instance-20260820-1842` | **`10.0.0.172`** | Ubuntu 24.04 |

- 리전 `ap-tokyo-1` · 두 대가 같은 VCN·서브넷에 있음 (사설 IP 포트 22 연결로 확인 완료)
- SSH 계정은 **`ubuntu`** 입니다. 키 파일은 **인스턴스마다 다릅니다.** 서로 바꿔 쓰면 접속이 안 됩니다.
  - A: `Downloads/ssh-key-2026-08-20_1726.key`
  - B: `Downloads/ssh-key-2026-08-20_1842.key`
- Windows 는 키 파일 권한을 조여야 SSH 가 받아줍니다.
  `icacls <키경로> /inheritance:r /grant:r "%USERNAME%:(R)"`
- **swap 2GB · Docker 29.1.3 · Compose v2.40.3 설치 완료** — 3번 과정은 건너뛰어도 됩니다
- 공인 IP 는 여기 적지 않습니다. 이 문서는 저장소에 올라가므로
  굳이 공개 접점을 함께 적어 둘 이유가 없습니다.
  `10.x.x.x` 사설 IP 는 인터넷에서 접근 불가한 주소라 적어도 무방합니다.

---

## 0. 준비물

| 항목 | 비고 |
|---|---|
| Oracle Cloud 계정 | **Always Free**. 업그레이드 버튼을 누르지 않습니다 |
| GitHub 저장소 | 이미지 빌드·보관에 사용 |
| 도메인 (선택) | 없으면 DuckDNS 같은 무료 서비스 |

### Oracle 계정에서 반드시 지킬 것

- **홈 리전을 춘천 또는 서울로** — Always Free 리소스는 홈 리전에만 만들 수 있고,
  홈 리전은 **나중에 변경할 수 없습니다**
- **"Upgrade" 버튼을 누르지 않습니다** — 누르는 순간 과금 가능한 계정이 됩니다
- 30일 체험 기간에 만든 **Always Free 대상이 아닌 리소스는 30일 후 회수**됩니다.
  처음부터 `VM.Standard.E2.1.Micro` 로만 만드세요

---

## 1. 인스턴스 2대 생성

Compute > Instances > Create Instance

| 설정 | 값 |
|---|---|
| Shape | **VM.Standard.E2.1.Micro** (Always Free eligible 표시 확인) |
| Image | Oracle Linux 9 (기본) 또는 Ubuntu 22.04. **두 대를 같은 이미지로** |
| 공인 IP | **두 대 모두 할당**. Assign a public IPv4 address 체크 |
| 부트 볼륨 | 기본값(46.6GB). 2대 합쳐 200GB 를 넘기지 않습니다 |
| SSH 키 | 생성해서 **개인키와 .pub 을 모두** 보관 |

**인스턴스 A** = `devnote-db`, **인스턴스 B** = `devnote-app` 처럼 이름을 구분해 둡니다.
도메인은 나중에 **인스턴스 B** 의 공인 IP 를 가리키게 됩니다.

### ⭐ 2번째 인스턴스 — VCN 을 새로 만들면 안 됩니다

1번째와 **모든 설정을 똑같이** 하되, Networking 섹션만 각별히 확인합니다.

```
Primary network
  ○ Create new virtual cloud network       ← ❌ 선택 금지
  ● Select existing virtual cloud network  ← ✅ 1번째와 같은 VCN
Subnet
  ● Select existing subnet                 ← ✅ 1번째와 같은 서브넷
```

**새 VCN 에 만들면 두 인스턴스가 사설 IP 로 통신하지 못합니다.**
백엔드가 DB 에 붙지 못하는데 원인이 네트워크라는 것을 알아채기 어려워
디버깅에 시간을 많이 씁니다. 여기서 한 번 확인하는 편이 훨씬 쌉니다.

1번째의 VCN·서브넷 이름은 **인스턴스 상세 > Primary VNIC** 에서 확인합니다.

**SSH 키 재사용**: "Paste public keys" 에 1번째의 `.pub` 내용을 넣습니다.
`.pub` 을 잃어버렸다면 개인키에서 다시 만들 수 있습니다.

```bash
ssh-keygen -y -f ~/.ssh/oracle-key.key
```

**Availability Domain** 은 1번째와 달라도 됩니다. 같은 VCN 이면 통신됩니다.
`Out of capacity` 가 뜨면 다른 AD 로 바꿔 재시도하세요.

### 생성 후 확인

| 확인 항목 | 있어야 하는 값 |
|---|---|
| Status | `RUNNING` |
| Shape | `VM.Standard.E2.1.Micro` ← **다르면 과금됩니다** |
| OCPU / Memory | `1/8` / `1GB` |
| Public IPv4 | 주소 있음 |
| Private IPv4 | 예 `10.0.0.149` — **메모** |
| Subnet | 두 인스턴스가 동일한지 |

```bash
# 접속해서 직접 확인 (Oracle Linux 이미지는 사용자명이 opc)
ssh -i <개인키> opc@<공인IP>        # Oracle Linux 는 opc, Ubuntu 는 ubuntu
nproc && free -h && df -h /
```

**각각의 사설 IP(Private IP)** 를 적어 둡니다. (A=`10.0.0.149`, B=`10.0.0.172`)

---

### 공인 IP 가 없다면 (Public IP address 가 `-`)

생성할 때 "Assign a public IPv4 address" 를 체크하지 않으면 이렇게 됩니다.
**이 상태로는 로컬 PC 에서 SSH 접속이 안 됩니다.** 인스턴스를 지울 필요는 없고
나중에 붙일 수 있습니다.

인스턴스 상세 > **Networking 탭** > Attached VNICs > VNIC 이름 클릭
> **IP administration** 탭 > Primary IP 행의 **⋮** > **Edit**
> Public IP type 을 **Ephemeral public IP** 로 변경 > Update

1 분 안에 공인 IP 가 생깁니다.

> **더 안전한 대안**: DB 인스턴스에는 공인 IP 를 주지 않고, 웹 인스턴스를
> 경유해서 접속할 수도 있습니다. SSH 노출 지점이 하나로 줄어듭니다.
> ```bash
> # 로컬 PC 에서. 개인키는 로컬에만 있으면 됩니다.
> ssh -i <개인키> -J opc@<B의_공인IP> opc@<A의_사설IP>
> ```
> 다만 백업 파일을 내려받을 때도 매번 `-J` 를 붙여야 하므로,
> 익숙하지 않다면 공인 IP 를 할당하는 편이 단순합니다.

### 두 인스턴스가 같은 네트워크인지 확인

**이 확인을 건너뛰면 7단계(백엔드 기동)에서야 증상이 나타납니다.**
그때는 원인 후보가 많아 찾기 어려우니 여기서 30초를 쓰는 편이 낫습니다.

**① VCN 개수** — Networking > Virtual Cloud Networks
VCN 이 1개뿐이면 확인 끝입니다.

**② Primary VNIC 비교** — 각 인스턴스 상세 > Primary VNIC

| 항목 | 판정 |
|---|---|
| Virtual cloud network | 두 인스턴스가 같아야 함 |
| Subnet | 두 인스턴스가 같아야 함 |
| Private IP | `10.0.0.149` / `10.0.0.172` 처럼 같은 대역 |

**③ 실제 통신 테스트** (결정적) — 인스턴스 A 에 SSH 접속 후

```bash
# 인스턴스 A(10.0.0.149) 에서 B(10.0.0.172) 로 확인
timeout 5 bash -c '</dev/tcp/10.0.0.172/22' && echo "같은 네트워크" || echo "확인 필요"
```

SSH 포트는 기본 보안 규칙에서 열려 있어 같은 VCN 이면 반드시 통과합니다.

> ⚠️ **`ping` 으로 테스트하지 마세요.** OCI 기본 보안 목록은 ICMP 요청을 허용하지
> 않습니다. 설정이 정상이어도 `ping` 은 실패하므로 멀쩡한 구성을 문제로 오판하게 됩니다.

### 실수로 새 VCN 에 만들었다면

인스턴스의 VCN·서브넷은 **생성 후 변경할 수 없습니다.** 다시 만드는 것이 가장 빠릅니다.

1. 잘못 만든 인스턴스 > More actions > **Terminate**
   → ⭐ **"Permanently delete the attached boot volumes" 체크**
   (안 켜면 46.6GB 부트 볼륨이 남아 200GB 한도를 계속 차지합니다)
2. Networking > Virtual Cloud Networks > 빈 VCN > **Delete**
   (인스턴스를 먼저 종료해야 삭제됩니다)
3. 기존 VCN·서브넷을 선택해 다시 생성

> VCN 피어링(LPG)으로 두 VCN 을 연결할 수도 있지만, 라우트 테이블과 보안 목록을
> 양쪽에 맞춰야 해서 관리 지점이 늘어납니다. 인스턴스가 비어 있는 단계에서는
> 재생성이 훨씬 간단합니다.
>
> 공인 IP 로 DB 에 접속하는 방식은 **쓰지 마세요.** MySQL 이 인터넷에 노출됩니다.

---

## 2. 네트워크 — 여기가 가장 실수하기 쉽습니다

### 2-1. 보안 목록 (Security List)

VCN > Subnet > Security List > Ingress Rules

| Source | Port | 용도 |
|---|---|---|
| `0.0.0.0/0` | 80 | 웹 (인스턴스 B) |
| `0.0.0.0/0` | 443 | HTTPS (인스턴스 B) |
| **`10.0.0.172/32`** | **3306** | DB 접근 — 인스턴스 B 에서만 |

**3306 을 `0.0.0.0/0` 으로 열면 안 됩니다.** MySQL 이 인터넷에 노출됩니다.

> 두 인스턴스가 **같은 서브넷**이라 이 보안 목록은 **두 대에 함께 적용**됩니다.
> 80/443 을 열면 인스턴스 A 에도 열리는 셈이지만, A 에는 그 포트를 듣는 것이
> 없으므로 문제되지 않습니다. **인스턴스별 구분은 OS 방화벽(2-2)이 담당**합니다.
> 더 엄격히 나누고 싶다면 서브넷 대신 NSG(Network Security Group)를 쓰면 됩니다.

### 2-2. OS 방화벽 — 콘솔만 열어서는 접속되지 않습니다

Oracle 이미지는 **OS 자체 방화벽이 기본으로 막고 있습니다.**
보안 목록만 열고 "왜 접속이 안 되지" 하는 경우 대부분 이것 때문입니다.
**보안 목록(2-1)과 OS 방화벽(2-2)을 둘 다** 열어야 합니다.

어느 OS 인지는 인스턴스 상세 > Image details 에서 확인합니다.

#### Oracle Linux 8 / 9 — firewalld

OL8 부터는 `firewalld` 가 기본으로 켜져 있습니다. `iptables` 명령을 직접 쓰면
재부팅 후 사라지거나 firewalld 규칙과 충돌하므로 `firewall-cmd` 를 씁니다.

**인스턴스 B (웹)**
```bash
sudo firewall-cmd --permanent --add-service=http     # 80
sudo firewall-cmd --permanent --add-service=https    # 443
sudo firewall-cmd --reload
sudo firewall-cmd --list-all                         # 확인
```

**인스턴스 A (DB)** — 인스턴스 B 의 사설 IP 에서만 3306 을 허용합니다.
```bash
# 10.0.0.172 = 인스턴스 B 의 사설 IP
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="10.0.0.172/32" port port="3306" protocol="tcp" accept'
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

> `--add-port=3306/tcp` 로 열면 **모든 곳에** 열립니다.
> 위 rich rule 은 특정 IP 에서만 허용하므로 훨씬 안전합니다.

> ⚠️ Docker 를 설치하면 Docker 가 자체 iptables 규칙을 넣습니다.
> `ports:` 로 공개한 포트는 firewalld 를 우회할 수 있으므로,
> **OCI 보안 목록(2-1)에서 막는 것이 최종 방어선**입니다. 2-1 을 건너뛰지 마세요.

#### Ubuntu — iptables

OCI Ubuntu 이미지의 기본 규칙은 이렇게 되어 있습니다.

```
1  RELATED,ESTABLISHED  ACCEPT
2  icmp                 ACCEPT
3  lo                   ACCEPT
4  tcp dport 22         ACCEPT
5  all                  REJECT   ← 여기 걸리면 끝
```

**새 규칙은 반드시 이 `REJECT` 보다 앞에** 들어가야 합니다.
`-I INPUT 6` 처럼 고정 번호를 쓰면 REJECT 뒤에 들어가 **아무 효과가 없습니다.**
(규칙 개수는 이미지마다 달라서 번호를 외워 쓰면 안 됩니다)

REJECT 위치를 계산해서 그 앞에 넣습니다.

```bash
# 인스턴스 B — 80, 443
for PORT in 80 443; do
  POS=$(sudo iptables -L INPUT --line-numbers -n | awk '/REJECT/{print $1; exit}')
  sudo iptables -I INPUT "$POS" -p tcp -m state --state NEW --dport $PORT -j ACCEPT
done
sudo netfilter-persistent save
```

```bash
# 인스턴스 A — 3306 을 B(10.0.0.172)에서만
POS=$(sudo iptables -L INPUT --line-numbers -n | awk '/REJECT/{print $1; exit}')
sudo iptables -I INPUT "$POS" -p tcp -m state --state NEW -s 10.0.0.172 --dport 3306 -j ACCEPT
sudo netfilter-persistent save
```

확인은 `sudo iptables -S INPUT` 으로 합니다.
**추가한 규칙이 마지막 REJECT 줄보다 위에 있어야** 정상입니다.

> `netfilter-persistent save` 를 빠뜨리면 재부팅 시 규칙이 사라집니다.



## 3. 두 인스턴스 공통 준비

**두 대 모두에서** 실행합니다.

### 3-1. Docker 설치

#### Oracle Linux 8 / 9

Oracle Linux 는 `podman` 계열이 미리 깔려 있어 Docker CE 와 충돌합니다.
**먼저 제거한 뒤** Docker 공식 저장소에서 설치합니다.

```bash
# 충돌하는 podman·runc 제거 (설치되어 있지 않아도 오류 없이 넘어갑니다)
sudo dnf remove -y podman buildah runc containers-common || true

# Docker 공식 저장소 추가 — OL9 는 CentOS 9 용 저장소를 그대로 씁니다
sudo dnf install -y dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

> 그래도 충돌이 나면 AppStream 의 컨테이너 모듈을 끄고 다시 시도합니다.
> ```bash
> sudo dnf module disable container-tools -y
> ```

#### Ubuntu

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
```

#### 공통 — 설치 확인

`usermod` 는 **다시 로그인해야 적용**됩니다. 로그아웃 후 재접속하세요.

```bash
exit
# 다시 SSH 접속 후
docker run --rm hello-world     # sudo 없이 되면 성공
docker compose version          # v2 확인 (docker-compose 아님)
```

### 3-2. swap 2GB — 1GB 인스턴스에서는 사실상 필수

메모리가 부족할 때 프로세스가 강제 종료되는 대신 디스크를 빌려 쓰게 합니다.
없으면 MySQL 이나 JVM 이 갑자기 죽습니다.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

free -h     # Swap 줄에 2.0Gi 가 보이면 성공
```

> `fallocate` 가 실패하면 (일부 파일시스템) 아래로 대체합니다.
> ```bash
> sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
> ```

echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 4. 인스턴스 A — MySQL

`compose.db.yml` 과 `.env.db` 를 올립니다.

**`.env.db`**
```bash
MYSQL_DATABASE=devnote
MYSQL_USERNAME=devnote
MYSQL_PASSWORD=<직접 생성한 강력한 비밀번호>
MYSQL_ROOT_PASSWORD=<직접 생성한 다른 비밀번호>
MYSQL_BIND_HOST=10.0.0.149      # 인스턴스 A 자신의 사설 IP
```

```bash
chmod 600 .env.db
docker compose -f compose.db.yml --env-file .env.db up -d
docker compose -f compose.db.yml logs -f mysql   # healthy 확인
```

---

## 5. 관리자 비밀번호 해시 생성 — 건너뛰지 마세요

`.env.example` 과 `compose.yml` 에 들어 있는 기본 해시는
**`admin / admin1234` 의 해시이며 이 저장소를 보는 누구나 알 수 있습니다.**
그대로 배포하면 누구나 최고 관리자로 로그인합니다.

이 프로젝트는 PBKDF2 형식(`반복횟수:base64(salt):base64(hash)`)을 씁니다.
(`MemberPasswordService.java` — SHA-256 · 600,000회 · salt 16바이트)

**로컬 PC에서** 아래를 실행하세요. 비밀번호는 직접 정하시고, **출력된 해시만 서버에 넣습니다.**

```bash
node scripts/generate-admin-hash.mjs "직접_정한_새_비밀번호"
```

이런 한 줄이 나옵니다.

```
600000:KqHEM/YI835eXzGyOPRMQw==:YWBFpGmX2w4ry/YI1rwOxvsxVQTSzgIH1QQj5pacvqU=
```

출력된 문자열을 `.env.app` 의 `INITIAL_SUPER_ADMIN_PASSWORD_HASH` 에 넣습니다.

> 형식이 맞지 않으면 로그인이 실패합니다. 배포 후 반드시 로그인을 확인하세요.

---

## 6. GitHub Actions 로 이미지 만들기

1. 저장소 **Settings > Actions > General > Workflow permissions**
   → **Read and write permissions** 선택 (없으면 push 가 거부됩니다)
2. `main` 에 푸시하면 `publish-images.yml` 이 돌면서
   `ghcr.io/<사용자명>/devnote-backend:main`, `devnote-frontend:main` 이 만들어집니다
3. **Packages > 각 이미지 > Package settings > Change visibility → Public**
   비공개로 두면 서버에서 `docker login` 이 필요합니다. 공개가 간단합니다

---

## 7. 인스턴스 B — 백엔드 + 프론트

**`.env.app`**
```bash
IMAGE_OWNER=<github-사용자명-소문자>
IMAGE_TAG=main

MYSQL_PRIVATE_HOST=10.0.0.149  # 인스턴스 A 의 사설 IP
MYSQL_DATABASE=devnote
MYSQL_USERNAME=devnote
MYSQL_PASSWORD=<A와 동일한 값>

INITIAL_SUPER_ADMIN_PASSWORD_HASH=<5번에서 만든 값>

SQL_INIT_MODE=always          # 첫 배포 후 never 로 변경
JPA_DDL_AUTO=validate         # 스키마 불일치로 기동이 막히면 none 으로 임시 우회
SESSION_COOKIE_SECURE=false   # HTTPS 붙인 뒤 true 로 변경
```

```bash
chmod 600 .env.app
docker compose -f compose.app.yml --env-file .env.app pull
docker compose -f compose.app.yml --env-file .env.app up -d
docker compose -f compose.app.yml logs -f backend
```

`http://<인스턴스 B 공인 IP>` 로 접속되면 성공입니다.
1/8 OCPU 라 첫 기동에 **2~3분** 걸릴 수 있습니다.

### 첫 배포 후

```bash
# 매 기동마다 DDL 을 돌지 않도록
sed -i 's/SQL_INIT_MODE=always/SQL_INIT_MODE=never/' .env.app
docker compose -f compose.app.yml --env-file .env.app up -d
```

---

## 8. HTTPS — Cloudflare (무료)

certbot 을 직접 설치하는 것보다 간단하고, 전송량도 아낄 수 있습니다.

1. Cloudflare 에 도메인 추가 (무료 플랜)
2. DNS > A 레코드 → 인스턴스 B 공인 IP, **프록시 켬(주황 구름)**
3. SSL/TLS > Overview → **Flexible** (서버가 80만 열려 있으므로)
4. SSL/TLS > Edge Certificates → **Always Use HTTPS** 켜기
5. 완료 후:

```bash
sed -i 's/SESSION_COOKIE_SECURE=false/SESSION_COOKIE_SECURE=true/' .env.app
docker compose -f compose.app.yml --env-file .env.app up -d
```

> **Flexible 은 Cloudflare↔서버 구간이 평문입니다.** 학습·포트폴리오에는 충분하지만,
> 더 엄격히 하려면 Cloudflare Origin Certificate 를 발급받아 nginx 에 넣고 **Full (strict)** 로 바꾸세요.

---

## 9. 배포 반영 (이후 코드 수정 시)

**절반만 자동입니다.** Actions 는 이미지를 만들기만 하고,
서버가 그걸 받아 가는 것은 별개의 단계입니다.

```
코드 수정 → commit → push(main) → Actions 이미지 빌드 → 서버 반영
                                  └── 자동 (1~4분) ──┘   └─ 수동 ─┘
```

### 한 줄로 반영하기

```bash
# 서버 정보는 셸에 한 번만 등록해 둔다
export APP_HOST=ubuntu@<공인IP>
export APP_KEY=~/Downloads/<키파일>

./scripts/deploy.sh
```

`deploy.sh` 는 pull → 컨테이너 교체 → healthy 대기 → 옛 이미지 정리까지 한다.
5분 안에 healthy 가 안 되면 백엔드 로그를 출력하고 실패로 끝난다.

빌드가 끝났는지는 이렇게 확인한다.

```bash
gh run list --limit 3
```

### 직접 하려면

```bash
# 인스턴스 B 에 접속해서
docker compose -f compose.app.yml --env-file .env.app pull
docker compose -f compose.app.yml --env-file .env.app up -d
```

> ⚠️ 워크플로는 **`main` 에 푸시될 때만** 동작한다.
> 다른 브랜치에 푸시하면 이미지가 만들어지지 않는다.

### 완전 자동 배포를 하지 않은 이유

Actions 에 SSH 배포 단계를 붙이면 push 만으로 서버까지 반영할 수 있다. 하지만
- SSH 개인키를 GitHub Secrets 에 넣어야 한다. **이 저장소는 공개**라 위험이 크다
- 테스트를 통과해도 실제로 깨지는 경우가 있는데, 자동 배포면 사이트가 그대로 죽는다
- 지금은 명령 한 줄이라 수동이어도 부담이 없다

혼자 쓰는 규모에서는 "원할 때 반영"이 더 안전하다.

---

## 10. 백업 — 반드시 설정하세요

업로드 파일은 **디스크에만** 있습니다. DB 에는 경로만 저장됩니다.
서버가 사라지면 파일도 사라집니다.

```bash
chmod +x scripts/backup.sh scripts/restore.sh

# 인스턴스 A
./scripts/backup.sh db

# 인스턴스 B
./scripts/backup.sh files
```

자동화 (각 인스턴스에서 `crontab -e`)
```
0 4 * * * cd ~/devnote && ./scripts/backup.sh db    >> ~/backup.log 2>&1
0 4 * * * cd ~/devnote && ./scripts/backup.sh files >> ~/backup.log 2>&1
```

**서버에만 두면 백업이 아닙니다.** 주기적으로 로컬 PC 로 내려받으세요.
```bash
scp -i <키> opc@<공인IP>:~/devnote-backups/*.gz ./
```

---

## 11. 다른 클라우드로 이사하기

이 구성은 **Docker Compose + 이미지 레지스트리** 조합이라 이사가 간단합니다.

1. 기존 서버에서 `backup.sh db`, `backup.sh files` 실행 후 로컬로 내려받기
2. 새 서버에 Docker 설치 + swap 설정 (3번 과정)
3. `compose.*.yml` 과 `.env.*` 복사 (사설 IP 만 새 값으로 수정)
4. `docker compose ... up -d`
5. `restore.sh db`, `restore.sh files` 로 데이터 복원
6. DNS A 레코드를 새 IP 로 변경

**소스 클론도, 빌드 도구 설치도 필요 없습니다.** 이미지를 받아 쓰기 때문입니다.

> 도메인을 쓰는 이유가 여기 있습니다. IP 로 공유하면 이사할 때마다 링크가 죽습니다.

---

## 문제 해결

| 증상 | 확인할 것 |
|---|---|
| 웹 접속 안 됨 | OS iptables (2-2), 보안 목록 80 포트 |
| 백엔드가 DB 접속 실패 | `MYSQL_PRIVATE_HOST` 값, A 인스턴스 iptables 3306, `MYSQL_BIND_HOST` |
| 로그인 후 바로 풀림 | `SESSION_COOKIE_SECURE` 와 실제 HTTPS 여부 불일치 |
| 관리자 로그인 실패 | 해시 형식(`반복:salt:hash`), 5번 재확인 |
| 컨테이너가 계속 재시작 | `docker stats` 로 메모리 확인, swap 적용 여부 |
| 기동이 매우 느림 | 정상입니다. 1/8 OCPU 라 2~3분 걸립니다 |
| 이미지 pull 실패 | ghcr 이미지가 Public 인지 (6번 3단계) |
| `Schema-validation:` 로그 후 기동 실패 | Entity 와 schema.sql 불일치. `.env.app` 에 `JPA_DDL_AUTO=none` 을 넣어 우선 띄우고, 로그의 불일치 항목을 로컬에서 수정 |
