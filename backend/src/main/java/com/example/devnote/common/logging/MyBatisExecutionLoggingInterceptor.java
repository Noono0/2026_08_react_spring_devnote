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
