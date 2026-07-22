import type { SupportedLanguage } from "@/server/execute/types";

export const SAMPLES: Record<SupportedLanguage, string> = {
  java: `import java.util.stream.IntStream;

public class Main {
    public static void main(String[] args) {
        System.out.println("Xin chào từ DevTility!");

        int sum = IntStream.rangeClosed(1, 100).sum();
        System.out.println("Tổng 1..100 = " + sum);
    }
}
`,
  python: `from datetime import date

print("Xin chào từ DevTility!")

squares = [n * n for n in range(1, 11)]
print(f"Bình phương 1..10: {squares}")
print(f"Hôm nay: {date.today():%d/%m/%Y}")
`,
  javascript: `console.log("Xin chào từ DevTility!");

const fib = (n) => (n <= 1 ? n : fib(n - 1) + fib(n - 2));
console.log("Fibonacci(10) =", fib(10));

console.log({ framework: "Next.js", runtime: "trình duyệt của bạn" });
`,
};

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  java: "Java",
  python: "Python",
  javascript: "JavaScript",
};
