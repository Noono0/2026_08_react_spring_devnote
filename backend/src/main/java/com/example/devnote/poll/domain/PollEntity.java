package com.example.devnote.poll.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 기존 Docker DB에도 새 컬럼이 반영되도록 테이블 구조를 표현하는 JPA Entity입니다.
 * 실제 투표 조회와 변경은 학습 흐름을 따라 MyBatis DAO가 담당합니다.
 */
@Getter
@Entity
@Table(name = "polls")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PollEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "poll_id") private Long pollId;
    @Column(name = "question", nullable = false, length = 300) private String question;
    @Column(name = "poll_status", nullable = false, length = 30) private String pollStatus;
    @Column(name = "allow_multiple", nullable = false, columnDefinition = "boolean default false") private Boolean allowMultiple;
    @Column(name = "max_selections", nullable = false, columnDefinition = "int default 1") private Integer maxSelections;
    @Column(name = "realtime_results", nullable = false, columnDefinition = "boolean default true") private Boolean realtimeResults;
    @Column(name = "ends_at") private LocalDateTime endsAt;
    @Column(name = "result_published_at") private LocalDateTime resultPublishedAt;
    @Column(name = "created_by", nullable = false) private Long createdBy;
    @Column(name = "use_yn", nullable = false, columnDefinition = "char(1) default 'Y'") private String useYn;
    @Column(name = "deleted_by") private Long deletedBy;
    @Column(name = "deleted_at") private LocalDateTime deletedAt;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
}
