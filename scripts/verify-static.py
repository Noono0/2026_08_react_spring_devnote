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


def pass_check(message: str) -> None:
    passes.append(message)
    print(f"[PASS] {message}")


def fail_check(message: str) -> None:
    failures.append(message)
    print(f"[FAIL] {message}")


def check_json() -> None:
    files = sorted(path for path in PROJECT_ROOT.rglob("*.json") if "node_modules" not in path.parts)
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
    files = sorted([*PROJECT_ROOT.glob("*.yml"), *PROJECT_ROOT.glob("*.yaml"), *BACKEND_ROOT.glob("src/main/resources/*.yml"), *PROJECT_ROOT.glob(".github/workflows/*.yml")])
    for path in files:
        try:
            yaml.safe_load(path.read_text(encoding="utf-8"))
        except Exception as error:
            fail_check(f"YAML syntax {path.relative_to(PROJECT_ROOT)}: {error}")
    if not any("YAML syntax" in failure for failure in failures):
        pass_check(f"YAML syntax: {len(files)} files")


def check_shell_scripts() -> None:
    bash_executable = shutil.which("bash")
    if bash_executable is None:
        print("[SKIP] bash is unavailable; shell syntax was not checked")
        return
    scripts = sorted(PROJECT_ROOT.glob("*.sh"))
    for script in scripts:
        result = subprocess.run([bash_executable, "-n", str(script)], capture_output=True, text=True)
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
        base_path.with_suffix(".ts"),
        base_path.with_suffix(".tsx"),
        base_path.with_suffix(".js"),
        base_path.with_suffix(".css"),
        base_path / "index.ts",
        base_path / "index.tsx",
    ]
    return any(candidate.exists() for candidate in candidates)


def check_local_imports() -> None:
    import_pattern = re.compile(r"(?:from\s+|import\s*(?:\(\s*)?)(?P<quote>['\"])(?P<value>[^'\"]+)(?P=quote)")
    source_files = sorted([*FRONTEND_ROOT.rglob("*.ts"), *FRONTEND_ROOT.rglob("*.tsx")])
    missing: list[str] = []
    for source_path in source_files:
        if "node_modules" in source_path.parts:
            continue
        source_text = source_path.read_text(encoding="utf-8")
        for match in import_pattern.finditer(source_text):
            import_value = match.group("value")
            if not resolve_import(source_path, import_value):
                missing.append(f"{source_path.relative_to(PROJECT_ROOT)} -> {import_value}")
    for item in missing:
        fail_check(f"Missing local import: {item}")
    if not missing:
        pass_check(f"Frontend local imports: {len(source_files)} source files")


def check_java_syntax() -> None:
    javac_executable = shutil.which("javac")
    java_executable = shutil.which("java")
    if javac_executable is None or java_executable is None:
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
    mapper_files = sorted((BACKEND_ROOT / "src/main/resources/mybatis/mapper").rglob("*.xml"))
    mapper_identifiers: set[str] = set()
    for mapper_file in mapper_files:
        root = ElementTree.parse(mapper_file).getroot()
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
    if not missing:
        pass_check(f"DAO/MyBatis statement links: {len(required_identifiers)} references")
    if unused:
        print(f"[INFO] Mapper statements not directly referenced by DAO scan: {', '.join(unused)}")


def check_feature_contracts() -> None:
    required_fragments = {
        "backend/src/main/resources/schema.sql": [
            "thumbnail_file_id BIGINT",
            "CREATE TABLE IF NOT EXISTS document_files",
        ],
        "backend/src/main/java/com/example/devnote/document/dto/DocumentCreateRequest.java": [
            "List<Long> attachmentFileIds",
            "Long thumbnailFileId",
        ],
        "backend/src/main/java/com/example/devnote/document/dto/DocumentDetailResponse.java": [
            "List<DocumentAttachmentResponse> attachmentFiles",
            "String thumbnailImageUrl",
        ],
        "backend/src/main/resources/mybatis/mapper/document/DocumentMapper.xml": [
            'id="insertDocumentAttachment"',
            'id="selectDocumentAttachments"',
            "thumbnail_image_url",
        ],
        "frontend/src/features/document/types/documentTypes.ts": [
            "attachmentFiles: DocumentAttachment[]",
            "attachmentFileIds: number[]",
            "thumbnailImageUrl?: string",
        ],
        "frontend/src/features/document/pages/DocumentListPage.tsx": [
            'viewMode === "thumbnail"',
            "DocumentThumbnailCard",
        ],
        "frontend/src/app/components/ApplicationSidebar.tsx": [
            "isSidebarCollapsed",
        ],
        "frontend/src/app/components/ApplicationTopBar.tsx": [
            "toggleApplicationTheme",
        ],
        "frontend/src/shared/config/dataSourceSelection.ts": [
            "getSelectedDataSource",
            "saveSelectedDataSource",
            "devnoteDataSource",
        ],
        "frontend/src/features/development/components/DataSourceToggle.tsx": [
            "더미 데이터 ON",
            "window.location.reload",
            'role="switch"',
        ],
        "frontend/src/mocks/startMockServerWhenEnabled.ts": [
            "getSelectedDataSource",
            'selectedDataSource !== "mock"',
            "setupWorker",
        ],
        "frontend/src/features/learning/components/LearningGuideButton.tsx": [
            "사용 방법",
            "학습 내용",
            "소스 흐름",
            "실습 과제",
        ],
        "frontend/src/features/learning/data/learningGuides.ts": [
            'guideId: "gallery"',
            'guideId: "reservation"',
            'guideId: "category"',
            'guideId: "admin"',
        ],
        "frontend/src/App.tsx": [
            '/practice/general-board',
            '/practice/gallery',
            '/practice/comments',
            '/practice/reservations',
            '/practice/inquiries',
            '/practice/categories',
            '/practice/admin-users',
        ],
    }
    for relative_path, fragments in required_fragments.items():
        complete_path = PROJECT_ROOT / relative_path
        if not complete_path.exists():
            fail_check(f"Required feature file missing: {relative_path}")
            continue
        text = complete_path.read_text(encoding="utf-8")
        for fragment in fragments:
            if fragment not in text:
                fail_check(f"Required integration fragment missing: {relative_path}: {fragment}")
    if not any("Required feature" in failure or "Required integration" in failure for failure in failures):
        pass_check("CRUD roadmap, guide modal, thumbnail, attachment, sidebar, theme and mock-toggle integration markers")



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
    compose_text = (PROJECT_ROOT / "compose.yml").read_text(encoding="utf-8")
    for service_name in ["mysql:", "backend:", "frontend:"]:
        if service_name not in compose_text:
            fail_check(f"Docker Compose service missing: {service_name}")

    frontend_section = compose_text.split("  frontend:", 1)[1].split("\nvolumes:", 1)[0]
    frontend_section = compose_text.split("  frontend:", 1)[1].split("\nvolumes:", 1)[0]
    if "depends_on:" in frontend_section:
        fail_check("Frontend must start independently from backend for mock-data practice")
    if "VITE_ENABLE_DEVELOPMENT_MENU: ${VITE_ENABLE_DEVELOPMENT_MENU:-true}" not in frontend_section:
        fail_check("Docker frontend learning menu must be enabled by default")

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
    check_feature_contracts()
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
