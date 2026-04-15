#ifndef MINUNIT_H
#define MINUNIT_H

#include <stdio.h>

static int _mu_run = 0;
static int _mu_pass = 0;
static int _mu_fail = 0;

#define mu_assert(label, cond)                                             \
    do {                                                                   \
        _mu_run++;                                                         \
        if (!(cond)) {                                                     \
            _mu_fail++;                                                    \
            printf("  FAIL  [%s:%d]  %s\n", __FILE__, __LINE__, label);    \
        } else {                                                           \
            _mu_pass++;                                                    \
        }                                                                  \
    } while (0)

#define mu_assert_int_eq(label, expected, actual)                          \
    do {                                                                   \
        int _e = (expected);                                               \
        int _a = (actual);                                                 \
        _mu_run++;                                                         \
        if (_e != _a) {                                                    \
            _mu_fail++;                                                    \
            printf("  FAIL  [%s:%d]  %s  expected=%d  got=%d\n",           \
                   __FILE__, __LINE__, label, _e, _a);                     \
        } else {                                                           \
            _mu_pass++;                                                    \
        }                                                                  \
    } while (0)

#define mu_assert_double_near(label, expected, actual, tol)                \
    do {                                                                   \
        double _d = (expected) - (actual);                                 \
        _mu_run++;                                                         \
        if (_d < 0) {                                                      \
            _d = -_d;                                                      \
        }                                                                  \
        if (_d > (tol)) {                                                  \
            _mu_fail++;                                                    \
            printf("  FAIL  [%s:%d]  %s  expected=%.4f  got=%.4f\n",       \
                   __FILE__, __LINE__, label, (double)(expected),          \
                   (double)(actual));                                      \
        } else {                                                           \
            _mu_pass++;                                                    \
        }                                                                  \
    } while (0)

#define mu_suite(name) do { printf("\n-- %s --\n", #name); name(); } while (0)

#define mu_summary()                                                       \
    do {                                                                   \
        printf("\n%s  %d/%d passed  (%d failed)%s\n",                      \
               (_mu_fail == 0) ? "\033[32mPASS" : "\033[31mFAIL",          \
               _mu_pass, _mu_run, _mu_fail, "\033[0m");                    \
        return (_mu_fail == 0) ? 0 : 1;                                    \
    } while (0)

#endif /* MINUNIT_H */
