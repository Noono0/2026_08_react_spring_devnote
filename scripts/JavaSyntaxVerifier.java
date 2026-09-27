import com.sun.source.util.JavacTask;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Stream;

public final class JavaSyntaxVerifier {
    private JavaSyntaxVerifier() {
    }

    public static void main(String[] arguments) throws IOException {
        if (arguments.length != 1) {
            throw new IllegalArgumentException("Usage: JavaSyntaxVerifier <backend directory>");
        }
        Path backendDirectory = Path.of(arguments[0]).toAbsolutePath().normalize();
        List<Path> sourcePaths;
        try (Stream<Path> pathStream = Files.walk(backendDirectory.resolve("src"))) {
            sourcePaths = pathStream
                .filter(path -> path.toString().endsWith(".java"))
                .sorted()
                .toList();
        }
        JavaCompiler javaCompiler = ToolProvider.getSystemJavaCompiler();
        if (javaCompiler == null) {
            throw new IllegalStateException("JDK compiler is unavailable. Install JDK 21.");
        }
        AtomicBoolean hasErrors = new AtomicBoolean();
        try (StandardJavaFileManager fileManager = javaCompiler.getStandardFileManager(null, null, null)) {
            Iterable<? extends JavaFileObject> sourceObjects = fileManager.getJavaFileObjectsFromPaths(sourcePaths);
            JavacTask javacTask = (JavacTask) javaCompiler.getTask(
                null,
                fileManager,
                diagnostic -> {
                    if (diagnostic.getKind() == javax.tools.Diagnostic.Kind.ERROR) {
                        hasErrors.set(true);
                        System.err.printf(
                            "[FAIL] %s:%d:%d %s%n",
                            diagnostic.getSource(),
                            diagnostic.getLineNumber(),
                            diagnostic.getColumnNumber(),
                            diagnostic.getMessage(null)
                        );
                    }
                },
                List.of("-proc:none", "--release", "21"),
                null,
                sourceObjects
            );
            javacTask.parse();
        }
        if (hasErrors.get()) {
            System.exit(1);
        }
        System.out.printf("[PASS] Java syntax parse: %d files%n", sourcePaths.size());
    }
}
