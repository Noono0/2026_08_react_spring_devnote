#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ElementTree
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover - only used outside the prepared project environment
    yaml = None

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_ROOT = PROJECT_ROOT / "frontend"
BACKEND_ROOT = PROJECT_ROOT / "backend"

failures: list[str] = []
passes: list[str] = []

EXCLUDED_DIRECTORIES = {
    ".git", ".idea", ".vscode", ".claude", ".local", ".gradle", ".gradle-wrapper",
    ".pnpm-store", "node_modules", "dist", "build", "__pycache__", ".venv",
}


def source_files(root: Path, suffixes: set[str]) -> list[Path]:
    """Prune dependency/build trees before traversal, not after reading every path."""
    matches: list[Path] = []
    for directory, children, filenames in os.walk(root):
        children[:] = sorted(child for child in children if child not in EXCLUDED_DIRECTORIES)
        matches.extend(Path(directory) / name for name in filenames if Path(name).suffix in suffixes)
    return sorted(matches)


def find_bash() -> str | None:
    if os.name == "nt":
        # System32/bash.exe is the WSL launcher, not Git Bash.
        for location in ("C:/Program Files/Git/bin/bash.exe", "C:/Program Files (x86)/Git/bin/bash.exe"):
            if Path(location).is_file():
                return location
    executable = shutil.which("bash")
    if executable and "windows/system32" in executable.replace("\\", "/").lower():
        return None
    return executable


def pass_check(message: str) -> None:
    passes.append(message)
    print(f"[PASS] {message}")


def fail_check(message: str) -> None:
    failures.append(message)
    print(f"[FAIL] {message}")


def check_json() -> None:
    files = source_files(PROJECT_ROOT, {".json"})
    for path in files:
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except Exception as error:
            fail_check(f"JSON syntax {path.relative_to(PROJECT_ROOT)}: {error}")
    if not any("JSON syntax" in failure for failure in failures):
        pass_check(f"JSON syntax: {len(files)} files")


def check_xml() -> None:
    files = sorted((BACKEND_ROOT / "src/main/resources").rglob("*.xml"))
    existing_files = [path for path in files if path.exists()]
    for path in existing_files:
        try:
            ElementTree.parse(path)
        except Exception as error:
            fail_check(f"XML syntax {path.relative_to(PROJECT_ROOT)}: {error}")
    if not any("XML syntax" in failure for failure in failures):
        pass_check(f"XML syntax: {len(existing_files)} files")


def check_yaml() -> None:
    if yaml is None:
        fail_check("PyYAML is unavailable; YAML syntax was not checked")
        return
    files = source_files(PROJECT_ROOT, {".yml", ".yaml"})
    for path in files:
        try:
            yaml.safe_load(path.read_text(encoding="utf-8"))
        except Exception as error:
            fail_check(f"YAML syntax {path.relative_to(PROJECT_ROOT)}: {error}")
    if not any("YAML syntax" in failure for failure in failures):
        pass_check(f"YAML syntax: {len(files)} files")


def check_shell_scripts() -> None:
    bash_executable = find_bash()
    if bash_executable is None:
        fail_check("Bash is unavailable; install Git Bash on Windows or bash on macOS/Linux")
        return
    scripts = source_files(PROJECT_ROOT, {".sh"}) + [BACKEND_ROOT / "gradlew"]
    for script in scripts:
        result = subprocess.run(
            [bash_executable, "-n", script.relative_to(PROJECT_ROOT).as_posix()],
            cwd=PROJECT_ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        if result.returncode != 0:
            fail_check(f"Shell syntax {script.name}: {result.stderr.strip()}")
    if not any("Shell syntax" in failure for failure in failures):
        pass_check(f"Shell syntax: {len(scripts)} files")


def check_typescript_syntax() -> None:
    node_executable = shutil.which("node")
    if node_executable is None:
        fail_check("Node.js is unavailable; TypeScript syntax was not checked")
        return
    result = subprocess.run(
        [node_executable, str(PROJECT_ROOT / "scripts/verify-typescript-syntax.cjs")],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    print(result.stdout, end="")
    if result.returncode != 0:
        fail_check(result.stderr.strip() or "TypeScript syntax verifier failed")
    else:
        passes.append("TypeScript/TSX syntax")


def resolve_import(source_path: Path, import_value: str) -> bool:
    if not (import_value.startswith("./") or import_value.startswith("../") or import_value.startswith("@/")):
        return True
    base_path = FRONTEND_ROOT / "src" / import_value[2:] if import_value.startswith("@/") else source_path.parent / import_value
    candidates = [
        base_path,
        Path(str(base_path) + ".ts"),
        Path(str(base_path) + ".tsx"),
        Path(str(base_path) + ".js"),
        Path(str(base_path) + ".css"),
        base_path / "index.ts",
        base_path / "index.tsx",
    ]
    return any(candidate.is_file() for candidate in candidates)


def check_local_imports() -> None:
    import_pattern = re.compile(r"(?:from\s+|import\s*(?:\(\s*)?)(?P<quote>['\"])(?P<value>[^'\"]+)(?P=quote)")
    frontend_files = source_files(FRONTEND_ROOT, {".ts", ".tsx"})
    missing: list[str] = []
    for source_path in frontend_files:
        source_text = source_path.read_text(encoding="utf-8")
        for match in import_pattern.finditer(source_text):
            import_value = match.group("value")
            if not resolve_import(source_path, import_value):
                missing.append(f"{source_path.relative_to(PROJECT_ROOT)} -> {import_value}")
    for item in missing:
        fail_check(f"Missing local import: {item}")
    if not missing:
        pass_check(f"Frontend local imports: {len(frontend_files)} source files")


def check_java_syntax() -> None:
    java_home = os.environ.get("JAVA_HOME")
    java_bin = Path(java_home) / "bin" if java_home else None
    executable_suffix = ".exe" if os.name == "nt" else ""
    javac_executable = str(java_bin / f"javac{executable_suffix}") if java_bin else shutil.which("javac")
    java_executable = str(java_bin / f"java{executable_suffix}") if java_bin else shutil.which("java")
    if not javac_executable or not java_executable or not Path(javac_executable).is_file() or not Path(java_executable).is_file():
        fail_check("JDK is unavailable; Java syntax was not checked")
        return
    with tempfile.TemporaryDirectory(prefix="devnote-java-verify-") as temporary_directory:
        compile_result = subprocess.run(
            [javac_executable, "-d", temporary_directory, str(PROJECT_ROOT / "scripts/JavaSyntaxVerifier.java")],
            capture_output=True,
            text=True,
        )
        if compile_result.returncode != 0:
            fail_check(f"Java verifier compilation failed: {compile_result.stderr.strip()}")
            return
        verify_result = subprocess.run(
            [java_executable, "-cp", temporary_directory, "JavaSyntaxVerifier", str(BACKEND_ROOT)],
            capture_output=True,
            text=True,
        )
        print(verify_result.stdout, end="")
        if verify_result.returncode != 0 or "[FAIL]" in verify_result.stderr:
            fail_check(verify_result.stderr.strip() or "Java syntax verifier failed")
        else:
            passes.append("Java syntax parse")


def check_mapper_identifiers() -> None:
    failure_count = len(failures)
    mapper_files = sorted((BACKEND_ROOT / "src/main/resources/mybatis/mapper").rglob("*.xml"))
    mapper_identifiers: set[str] = set()
    for mapper_file in mapper_files:
        try:
            root = ElementTree.parse(mapper_file).getroot()
        except ElementTree.ParseError as error:
            fail_check(f"Mapper XML syntax {mapper_file.relative_to(PROJECT_ROOT)}: {error}")
            continue
        namespace = root.attrib.get("namespace", "")
        for child in root:
            identifier = child.attrib.get("id")
            if child.tag in {"select", "insert", "update", "delete"} and identifier:
                mapper_identifiers.add(namespace + "." + identifier)

    dao_files = sorted((BACKEND_ROOT / "src/main/java").rglob("*DaoImpl.java"))
    required_identifiers: set[str] = set()
    namespace_pattern = re.compile(r'NAMESPACE\s*=\s*"([^"]+)"')
    statement_pattern = re.compile(r'NAMESPACE\s*\+\s*"([^"]+)"')
    for dao_file in dao_files:
        text = dao_file.read_text(encoding="utf-8")
        namespace_match = namespace_pattern.search(text)
        if not namespace_match:
            continue
        namespace = namespace_match.group(1)
        required_identifiers.update(namespace + match.group(1) for match in statement_pattern.finditer(text))

    missing = sorted(required_identifiers - mapper_identifiers)
    unused = sorted(mapper_identifiers - required_identifiers)
    for identifier in missing:
        fail_check(f"DAO references missing MyBatis statement: {identifier}")
    if not missing and len(failures) == failure_count:
        pass_check(f"DAO/MyBatis statement links: {len(required_identifiers)} references")
    if unused:
        print(f"[INFO] Mapper statements not directly referenced by DAO scan: {', '.join(unused)}")


def check_gradle_build_files() -> None:
    required = [
        BACKEND_ROOT / "build.gradle",
        BACKEND_ROOT / "settings.gradle",
        BACKEND_ROOT / "gradle.properties",
        BACKEND_ROOT / "gradlew",
        BACKEND_ROOT / "gradlew.bat",
        BACKEND_ROOT / "gradle/wrapper/gradle-wrapper.properties",
    ]
    missing = [path for path in required if not path.exists()]
    for path in missing:
        fail_check(f"Gradle-required file missing: {path.relative_to(PROJECT_ROOT)}")

    build_file = BACKEND_ROOT / "build.gradle"
    if build_file.exists():
        text = build_file.read_text(encoding="utf-8")
        required_fragments = [
            "id 'org.springframework.boot' version '3.5.16'",
            "JavaLanguageVersion.of(21)",
            "mybatis-spring-boot-starter",
            "springdoc-openapi-starter-webmvc-ui",
            "org.testcontainers:mysql",
            "useJUnitPlatform()",
        ]
        for fragment in required_fragments:
            if fragment not in text:
                fail_check(f"Gradle build fragment missing: {fragment}")

    dockerfile = BACKEND_ROOT / "Dockerfile"
    if dockerfile.exists():
        docker_text = dockerfile.read_text(encoding="utf-8")
        if "FROM gradle:8.14.4-jdk21 AS build" not in docker_text:
            fail_check("Backend Dockerfile is not using Gradle 8.14.4 JDK 21 builder")
        if "/build/libs/devnote-backend-*.jar" not in docker_text:
            fail_check("Backend Dockerfile does not copy the Gradle bootJar output")

    forbidden = [BACKEND_ROOT / "pom.xml", BACKEND_ROOT / "mvnw", BACKEND_ROOT / "mvnw.cmd", BACKEND_ROOT / ".mvn"]
    for path in forbidden:
        if path.exists():
            fail_check(f"Maven artifact still exists after Gradle migration: {path.relative_to(PROJECT_ROOT)}")

    if not any("Gradle" in failure or "Maven artifact" in failure or "Backend Dockerfile" in failure for failure in failures):
        pass_check("Gradle backend build files and Maven cleanup")

def check_docker_references() -> None:
    required_paths = [
        FRONTEND_ROOT / "Dockerfile",
        FRONTEND_ROOT / "nginx.conf",
        BACKEND_ROOT / "Dockerfile",
        BACKEND_ROOT / "build.gradle",
        BACKEND_ROOT / "settings.gradle",
        BACKEND_ROOT / "gradlew",
        PROJECT_ROOT / "compose.yml",
    ]
    missing = [path for path in required_paths if not path.exists()]
    for path in missing:
        fail_check(f"Docker-required file missing: {path.relative_to(PROJECT_ROOT)}")
    if missing or yaml is None:
        return
    try:
        compose = yaml.safe_load((PROJECT_ROOT / "compose.yml").read_text(encoding="utf-8"))
        services = compose["services"]
        for service_name in ("mysql", "backend", "frontend"):
            if service_name not in services:
                fail_check(f"Docker Compose service missing: {service_name}")
        frontend = services.get("frontend", {})
        if frontend.get("depends_on"):
            fail_check("Frontend must start independently from backend for mock-data practice")
        arguments = frontend.get("build", {}).get("args", {})
        if arguments.get("VITE_ENABLE_DEVELOPMENT_MENU") != "${VITE_ENABLE_DEVELOPMENT_MENU:-true}":
            fail_check("Docker frontend learning menu must be enabled by default")
    except (yaml.YAMLError, KeyError, TypeError, AttributeError) as error:
        fail_check(f"Docker Compose structure: {error}")
        return

    nginx_text = (FRONTEND_ROOT / "nginx.conf").read_text(encoding="utf-8")
    if "resolver 127.0.0.11" not in nginx_text or "set $backend_host backend;" not in nginx_text:
        fail_check("Nginx must resolve backend dynamically so mock mode starts independently")

    if not missing and not any(
        marker in failure
        for failure in failures
        for marker in ["Docker Compose service", "Frontend must start", "learning menu", "Nginx must resolve"]
    ):
        pass_check("Docker Compose services and backend-independent mock practice")


def main() -> int:
    print(f"Static verification root: {PROJECT_ROOT}")
    check_json()
    check_xml()
    check_yaml()
    check_shell_scripts()
    check_typescript_syntax()
    check_local_imports()
    check_java_syntax()
    check_mapper_identifiers()
    check_gradle_build_files()
    check_docker_references()
    print()
    if failures:
        print(f"Static verification FAILED: {len(failures)} issue(s)")
        return 1
    print(f"Static verification PASSED: {len(passes)} check group(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
