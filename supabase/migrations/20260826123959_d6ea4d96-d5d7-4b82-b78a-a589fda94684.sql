DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname IN ('expire-lost-items-daily','process-recurring-tasks-daily','process-recurring-tasks-hourly') AND active LOOP
    PERFORM cron.alter_job(job_id := j.jobid, active := false);
  END LOOP;
END $$;