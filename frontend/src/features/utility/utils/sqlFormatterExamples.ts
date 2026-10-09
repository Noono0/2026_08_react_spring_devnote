/**
 * sqlFormatterExamples.ts — SQL Formatter "예제" 버튼이 넣는 복잡한 쿼리와 테이블·칼럼 코멘트(MySQL DDL)
 *
 * 정리기가 다루는 것을 한 번에 시험해 보도록 골고루 넣었다:
 *   WITH(CTE), 스칼라 서브쿼리, CASE WHEN ... AND, INNER/LEFT JOIN, 서브쿼리 JOIN, EXISTS, NOT IN (SELECT),
 *   BETWEEN ... AND, LIKE, IS NOT NULL, IN ( ... ), ORDER BY 여러 개, LIMIT/OFFSET, MyBatis #{파라미터}, 두 번째 문장(UPDATE)
 * 코멘트는 CREATE TABLE ... COMMENT 형식이라 DDL 읽기도 함께 확인된다.
 */

export const complexExampleSql = `with recent_orders as (select o.member_id, count(*) as order_cnt, sum(o.total_amount) as total_amount from orders o where o.ordered_at between #{startDate} and #{endDate} and o.status <> 'CANCELED' group by o.member_id) select m.member_id, m.member_name, m.email, g.grade_name, ro.order_cnt, ro.total_amount, (select max(p.paid_at) from payments p where p.member_id = m.member_id) as last_paid_at, case when ro.total_amount >= 1000000 then 'VIP' when ro.total_amount >= 300000 and ro.order_cnt > 5 then 'GOLD' else 'NORMAL' end as member_level, coalesce(c.coupon_cnt, 0) coupon_cnt from members m inner join member_grades g on g.grade_id = m.grade_id left join recent_orders ro on ro.member_id = m.member_id left join (select cp.member_id, count(*) as coupon_cnt from coupons cp where cp.used_yn = 'N' and cp.expired_at > now() group by cp.member_id) c on c.member_id = m.member_id where m.use_yn = 'Y' and m.joined_at >= '2024-01-01' and (m.email like '%@gmail.com' or m.phone is not null) and exists (select 1 from orders o2 where o2.member_id = m.member_id and o2.status in ('PAID', 'SHIPPED', 'DONE')) and m.member_id not in (select b.member_id from blacklist b where b.active_yn = 'Y') order by ro.total_amount desc, m.member_name asc limit #{pageSize} offset #{offset};
update members set grade_id = #{gradeId}, updated_at = now(), updated_by = #{adminId} where member_id = #{memberId} and use_yn = 'Y';`;

export const complexExampleComments = `CREATE TABLE members (
  member_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '회원아이디',
  member_name VARCHAR(50) NOT NULL COMMENT '회원이름',
  email VARCHAR(100) COMMENT '이메일',
  phone VARCHAR(20) COMMENT '휴대폰번호',
  grade_id INT COMMENT '등급아이디',
  use_yn CHAR(1) DEFAULT 'Y' COMMENT '사용여부',
  joined_at DATETIME COMMENT '가입일시',
  updated_at DATETIME COMMENT '수정일시',
  updated_by BIGINT COMMENT '수정자',
  PRIMARY KEY (member_id)
) ENGINE=InnoDB COMMENT='회원';

CREATE TABLE member_grades (
  grade_id INT NOT NULL COMMENT '등급아이디',
  grade_name VARCHAR(30) COMMENT '등급명',
  PRIMARY KEY (grade_id)
) COMMENT='회원등급';

CREATE TABLE orders (
  order_id BIGINT NOT NULL COMMENT '주문아이디',
  member_id BIGINT NOT NULL COMMENT '주문회원',
  total_amount DECIMAL(12,2) COMMENT '주문금액',
  status VARCHAR(20) COMMENT '주문상태',
  ordered_at DATETIME COMMENT '주문일시'
) COMMENT='주문';

CREATE TABLE payments (
  payment_id BIGINT COMMENT '결제아이디',
  member_id BIGINT COMMENT '결제회원',
  paid_at DATETIME COMMENT '결제일시'
) COMMENT='결제';

CREATE TABLE coupons (
  coupon_id BIGINT COMMENT '쿠폰아이디',
  member_id BIGINT COMMENT '쿠폰회원',
  used_yn CHAR(1) COMMENT '사용여부',
  expired_at DATETIME COMMENT '만료일시'
) COMMENT='쿠폰';

CREATE TABLE blacklist (
  member_id BIGINT COMMENT '차단회원',
  active_yn CHAR(1) COMMENT '차단여부'
) COMMENT='블랙리스트';`;
