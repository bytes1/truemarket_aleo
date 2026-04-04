// The 'test_sample' test program.
import sample.aleo;
program test_sample.aleo {
    @test
    fn test_it() {
        let result: u32 = sample.aleo::main(1u32, 2u32);
        assert_eq(result, 3u32);
    }

    @test
    @should_fail
    fn do_nothing() {
        let result: u32 = sample.aleo::main(2u32, 3u32);
        assert_eq(result, 3u32);
    }

    fn constructor() {}
}
