package com.example.devnote.common.logging;

import lombok.extern.slf4j.Slf4j;
import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.plugin.Interceptor;
import org.apache.ibatis.plugin.Intercepts;
import org.apache.ibatis.plugin.Invocation;
import org.apache.ibatis.plugin.Signature;
import org.springframework.stereotype.Component;

import java.util.Collection;

/**
 * MyBatis가 SQL을 실행할 때마다 "어느 Mapper의 어느 SQL이, 몇 건을, 몇 ms에" 처리했는지 기록합니다.
 *
 * [P6SpySqlFormatter와의 차이]
 *   P6Spy  : 실제로 DB에 간 SQL 문장(? 자리에 값이 채워진 모양)을 보여 준다.
 *   이 클래스: Mapper XML의 id(예: com.example.devnote.document.DocumentMapper.selectDocumentList)를 보여 준다.
 *   → 둘을 같은 traceId로 맞춰 보면 "이 SQL이 XML의 어디에 적혀 있는지" 바로 찾을 수 있다.
 *
 * @Intercepts/@Signature: MyBatis 내부 Executor의 update(INSERT·UPDATE·DELETE)와 query(SELECT) 메서드를 가로챈다.
 * @Component로 등록하면 MyBatis Spring Boot 자동 설정이 Interceptor Bean을 찾아 플러그인으로 붙인다.
 */
@Slf4j
@Component
@Intercepts({
    @Signature(type = Executor.class, method = "update", args = {MappedStatement.class, Object.class}),
    @Signature(type = Executor.class, method = "query", args = {
        MappedStatement.class, Object.class,
        org.apache.ibatis.session.RowBounds.class,
        org.apache.ibatis.session.ResultHandler.class
    })
})
public class MyBatisExecutionLoggingInterceptor implements Interceptor {
    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        // 첫 번째 인자 MappedStatement = Mapper XML의 <select id="..."> 하나에 해당하는 정보.
        MappedStatement mappedStatement = (MappedStatement) invocation.getArgs()[0];
        long startedAt = System.nanoTime();
        try {
            Object result = invocation.proceed();
            long elapsedMilliseconds = (System.nanoTime() - startedAt) / 1_000_000;
            log.debug("[MYBATIS] mapperId={}, command={}, resultCount={}, elapsedMs={}",
                mappedStatement.getId(),
                mappedStatement.getSqlCommandType(),
                getResultCount(result),
                elapsedMilliseconds);
            return result;
        } catch (Throwable throwable) {
            long elapsedMilliseconds = (System.nanoTime() - startedAt) / 1_000_000;
            log.error("[MYBATIS-ERROR] mapperId={}, command={}, elapsedMs={}",
                mappedStatement.getId(), mappedStatement.getSqlCommandType(), elapsedMilliseconds);
            throw throwable;
        }
    }

    /** SELECT는 목록 크기, INSERT·UPDATE·DELETE는 영향받은 행 수(Number)를 결과 건수로 쓴다. */
    private int getResultCount(Object result) {
        if (result instanceof Collection<?> collection) {
            return collection.size();
        }
        if (result instanceof Number number) {
            return number.intValue();
        }
        return result == null ? 0 : 1;
    }
}
